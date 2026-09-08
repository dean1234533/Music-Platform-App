import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'
import { requireActiveUser } from './roles.js'
import { enforceRateLimit } from './rateLimit.js'
import { getStorage } from 'firebase-admin/storage'

type PlaybackKind = 'preview' | 'stream'

async function canPlayTrack(uid: string | null, track: FirebaseFirestore.DocumentData): Promise<boolean> {
  if (track.takenDown === true || (track.restrictedCapabilities ?? []).includes('streaming')) return false
  if (uid === track.artistId) return true

  let roles: string[] = []
  if (uid) {
    const user = await db.collection('users').doc(uid).get()
    roles = (user.data()?.roles ?? []) as string[]
    if (roles.includes('admin')) return true
  }
  if (track.visibility === 'public') return true
  if (!uid) return false
  if (track.visibility === 'dj_only') return roles.includes('dj')
  if (track.visibility === 'followers' || track.visibility === 'early_access') {
    return (await db.collection('follows').doc(`${uid}_${track.artistId}`).get()).exists
  }
  if (track.visibility === 'supporters') {
    return (await db.collection('supportRelationships').doc(`${uid}_${track.artistId}`).get()).exists
  }
  return false
}

/**
 * Returns a short-lived URL only after checking current track visibility and
 * moderation state. This avoids permanent Firebase download tokens keeping a
 * preview playable after a takedown or entitlement change.
 */
export const getTrackPlaybackUrl = onCall(async (request) => {
  const { trackId, kind } = request.data ?? {} as { trackId?: string; kind?: PlaybackKind }
  if (!trackId || (kind !== 'preview' && kind !== 'stream')) {
    throw new HttpsError('invalid-argument', 'trackId and a valid playback kind are required.')
  }
  const snap = await db.collection('tracks').doc(trackId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'Track does not exist.')
  const track = snap.data()!
  if (!(await canPlayTrack(request.auth?.uid ?? null, track))) {
    throw new HttpsError('permission-denied', 'You do not have access to this audio.')
  }
  const path = kind === 'preview' ? track.previewAudioPath : track.streamAudioPath
  const expectedPrefix = `artists/${track.artistId}/${kind === 'preview' ? 'previews' : 'streaming'}/`
  if (typeof path !== 'string' || !path.startsWith(expectedPrefix)) {
    throw new HttpsError('failed-precondition', 'The track audio path is invalid.')
  }
  const [url] = await getStorage().bucket().file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + 10 * 60 * 1000,
  })
  return { url }
})

async function deleteQuery(query: FirebaseFirestore.Query): Promise<void> {
  const snap = await query.get()
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch()
    for (const row of snap.docs.slice(i, i + 400)) batch.delete(row.ref)
    await batch.commit()
  }
}

export const deleteTrack = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const trackId = request.data?.trackId
  if (!trackId || typeof trackId !== 'string') throw new HttpsError('invalid-argument', 'trackId is required.')
  const ref = db.collection('tracks').doc(trackId)
  const snap = await ref.get()
  if (!snap.exists) return { ok: true }
  const track = snap.data()!
  if (track.artistId !== request.auth.uid) throw new HttpsError('permission-denied', 'Only the artist can delete this track.')
  if (track.legalHold === true) throw new HttpsError('failed-precondition', 'This track is under legal hold and cannot be deleted.')
  const activeAgreement = await db.collection('licenceAgreements').where('trackId', '==', trackId).where('status', '==', 'active').limit(1).get()
  if (!activeAgreement.empty) {
    throw new HttpsError('failed-precondition', 'This track has an active licence. Unpublish it instead so the signed entitlement remains available.')
  }

  const bucket = getStorage().bucket()
  await Promise.all([
    track.originalAudioPath ? bucket.file(track.originalAudioPath).delete({ ignoreNotFound: true }) : Promise.resolve(),
    track.previewAudioPath ? bucket.file(track.previewAudioPath).delete({ ignoreNotFound: true }) : Promise.resolve(),
    track.streamAudioPath ? bucket.file(track.streamAudioPath).delete({ ignoreNotFound: true }) : Promise.resolve(),
    bucket.deleteFiles({ prefix: `artists/${track.artistId}/artwork/${trackId}.` }),
  ])

  const [playlists, crates] = await Promise.all([
    db.collection('playlists').where('trackIds', 'array-contains', trackId).get(),
    db.collection('crates').where('trackIds', 'array-contains', trackId).get(),
  ])
  for (const rows of [playlists, crates]) {
    for (let i = 0; i < rows.docs.length; i += 400) {
      const batch = db.batch()
      for (const row of rows.docs.slice(i, i + 400)) batch.update(row.ref, { trackIds: FieldValue.arrayRemove(trackId), updatedAt: FieldValue.serverTimestamp() })
      await batch.commit()
    }
  }
  await Promise.all([
    deleteQuery(db.collection('trackLikes').where('trackId', '==', trackId)),
    deleteQuery(db.collection('djDeals').where('trackId', '==', trackId)),
  ])
  await ref.delete()
  return { ok: true }
})

/**
 * playCount lives only on the server so a listener can't inflate their own
 * favourite tracks by hammering an updateDoc from the client — Firestore
 * rules also reject any client write that changes playCount directly.
 * Deliberately callable while signed out (public previews are meant to be
 * playable by anonymous visitors), so the abuse control here is a coarse
 * per-track rate limit rather than a per-user one.
 */
export const recordPreviewPlay = onCall(async (request) => {
  const trackId = request.data?.trackId as string | undefined
  if (!trackId || typeof trackId !== 'string') {
    throw new HttpsError('invalid-argument', 'trackId is required.')
  }
  await enforceRateLimit(`recordPreviewPlay_${trackId}`, 120, 60)

  const ref = db.collection('tracks').doc(trackId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Track does not exist.')
  }

  await ref.update({ playCount: FieldValue.increment(1) })
  return { ok: true }
})
