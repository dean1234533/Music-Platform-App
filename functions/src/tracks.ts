import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'
import { requireActiveUser } from './roles.js'
import { enforceRateLimit } from './rateLimit.js'
import { getStorage } from 'firebase-admin/storage'

type PlaybackKind = 'preview' | 'stream'

async function getRoles(uid: string): Promise<string[]> {
  const user = await db.collection('users').doc(uid).get()
  return (user.data()?.roles ?? []) as string[]
}

/**
 * Whether this listener may hear the configured preview clip. Deliberately
 * permissive — the acquisition funnel (preview -> follow -> full track) only
 * works if a follower/supporter-tier track's preview stays open to everyone,
 * not just entitled listeners. A public visitor previewing a supporters-only
 * track and a follower previewing that same track get the identical preview;
 * only the full-stream check below actually gates anything by relationship.
 */
async function canPreviewTrack(uid: string | null, track: FirebaseFirestore.DocumentData): Promise<boolean> {
  if (track.takenDown === true || (track.restrictedCapabilities ?? []).includes('streaming')) return false
  if (uid === track.artistId) return true
  if (track.visibility === 'private') {
    return uid ? (await getRoles(uid)).includes('admin') : false
  }
  if (track.visibility === 'dj_only') {
    if (!uid) return false
    const roles = await getRoles(uid)
    return roles.includes('dj') || roles.includes('admin')
  }
  return true
}

/**
 * Whether this listener may hear the full-length stream — the strict
 * entitlement ladder (public / followers / supporters / dj_only / private).
 * Supporter access additionally requires the fan's own subscription to
 * currently be active: supportRelationships isn't cleaned up the instant a
 * subscription lapses (it only changes on the next allocation write), so
 * relationship-existence alone isn't proof of a live paid relationship.
 */
async function canStreamFullTrack(uid: string | null, track: FirebaseFirestore.DocumentData): Promise<boolean> {
  if (track.takenDown === true || (track.restrictedCapabilities ?? []).includes('streaming')) return false
  if (uid === track.artistId) return true

  let roles: string[] = []
  if (uid) {
    roles = await getRoles(uid)
    if (roles.includes('admin')) return true
  }
  if (track.visibility === 'public') return true
  if (!uid) return false
  if (track.visibility === 'dj_only') return roles.includes('dj')
  if (track.visibility === 'followers' || track.visibility === 'early_access') {
    return (await db.collection('follows').doc(`${uid}_${track.artistId}`).get()).exists
  }
  if (track.visibility === 'supporters') {
    const [relSnap, subSnap] = await Promise.all([
      db.collection('supportRelationships').doc(`${uid}_${track.artistId}`).get(),
      db.collection('subscriptions').doc(`${uid}_fan`).get(),
    ])
    if (!relSnap.exists) return false
    const status = subSnap.data()?.status
    return status === 'active' || status === 'trialing'
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
  const uid = request.auth?.uid ?? null
  const allowed = kind === 'preview' ? await canPreviewTrack(uid, track) : await canStreamFullTrack(uid, track)
  if (!allowed) {
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

  // Prefix-delete rather than deleting the exact stored path — the stored
  // originalAudioPath/previewAudioPath/streamAudioPath fields only need to
  // have been right at upload time to have played correctly since; if any
  // ever drifted from the real Storage path (a legacy doc, a stale field),
  // an exact bucket.file(path).delete() silently no-ops via ignoreNotFound
  // instead of actually removing the file. The trackId segment of the path
  // is always reliable since it's the Firestore doc id itself.
  const bucket = getStorage().bucket()
  await Promise.all([
    bucket.deleteFiles({ prefix: `artists/${track.artistId}/originals/${trackId}.` }),
    bucket.deleteFiles({ prefix: `artists/${track.artistId}/streaming/${trackId}.` }),
    bucket.deleteFiles({ prefix: `artists/${track.artistId}/previews/${trackId}.` }),
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
 * Play counts live only on the server so a listener can't inflate their own
 * favourite tracks by hammering an updateDoc from the client — Firestore
 * rules also reject any client write that changes these fields directly.
 * Deliberately callable while signed out (public previews are meant to be
 * playable by anonymous visitors), so the abuse control here is a coarse
 * per-track rate limit rather than a per-user one.
 *
 * playCount == preview plays (kept under its original name — every existing
 * track already has real data in it and every dashboard already labels it
 * "preview"/"sample" plays). fullPlayCount is the new full-stream counter;
 * supporterPlayCount/djPreviewCount are narrower breakdowns of those two,
 * not separate totals — never summed together for a "total plays" figure.
 */
export const recordTrackPlay = onCall(async (request) => {
  const trackId = request.data?.trackId as string | undefined
  const kind = request.data?.kind as PlaybackKind | undefined
  if (!trackId || (kind !== 'preview' && kind !== 'stream')) {
    throw new HttpsError('invalid-argument', 'trackId and a valid playback kind are required.')
  }
  await enforceRateLimit(`recordTrackPlay_${trackId}`, 120, 60)

  const ref = db.collection('tracks').doc(trackId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Track does not exist.')
  }
  const track = snap.data()!

  const update: Record<string, unknown> = {}
  if (kind === 'preview') {
    update.playCount = FieldValue.increment(1)
    if (track.visibility === 'dj_only') update.djPreviewCount = FieldValue.increment(1)
  } else {
    update.fullPlayCount = FieldValue.increment(1)
    if (track.visibility === 'supporters') update.supporterPlayCount = FieldValue.increment(1)
  }
  await ref.update(update)
  return { ok: true }
})
