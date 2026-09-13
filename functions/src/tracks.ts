import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from './admin.js'
import { requireActiveUser } from './roles.js'
import { enforceRateLimit } from './rateLimit.js'
import { getStorage } from 'firebase-admin/storage'
import { isValidYoutubeVideoId } from './youtube.js'

function isPublished(track: FirebaseFirestore.DocumentData): boolean {
  // Compatibility: tracks created before the status field existed were
  // published atomically after their files uploaded, so an absent value is published.
  return track.status === undefined || track.status === 'published'
}

async function getRoles(uid: string): Promise<string[]> {
  const user = await db.collection('users').doc(uid).get()
  return (user.data()?.roles ?? []) as string[]
}

/** Mirrors firestore.rules' roleActiveFor — an artist who has stepped back from the role (removeRole) goes dark everywhere, not just their profile page. */
async function artistRoleActive(artistId: string): Promise<boolean> {
  return (await getRoles(artistId)).includes('artist')
}

/**
 * "Supporter" now means: has ever made a one-off support payment to this
 * artist. There is no more recurring fan subscription to check — a
 * supportRelationships doc is only ever created by a real, server-recorded
 * Stripe payment (see functions/src/stripe/webhook.ts's
 * handleSupportCheckoutCompleted), never by the client.
 */
async function isActiveSupporter(uid: string, artistId: string): Promise<boolean> {
  const relSnap = await db.collection('supportRelationships').doc(`${uid}_${artistId}`).get()
  return relSnap.exists
}

/**
 * Whether this viewer may be shown this track's YouTube link at all — the
 * same public/followers/supporters/dj_only/private ladder that used to gate
 * full-stream audio now gates whether we ever hand back the video ID. Once
 * revealed, YouTube itself controls actual playback (this only controls
 * whether BackTheVibes discloses the link).
 */
async function canAccessTrackYoutubeLink(uid: string | null, track: FirebaseFirestore.DocumentData): Promise<boolean> {
  if (track.takenDown === true || (track.restrictedCapabilities ?? []).includes('streaming')) return false
  if (uid === track.artistId) return true

  let roles: string[] = []
  if (uid) {
    roles = await getRoles(uid)
    if (roles.includes('admin')) return true
  }
  if (!isPublished(track)) return false
  if (!(await artistRoleActive(track.artistId))) return false
  if (track.visibility === 'public') return true
  if (track.visibility === 'dj_only') return !!uid && roles.includes('dj')
  if (track.visibility === 'private') return false
  if (!uid) {
    // early_access can still be open to signed-out visitors once its public date passes.
    if (track.visibility === 'early_access') {
      const publicAt = (track.publicReleaseAt as FirebaseFirestore.Timestamp | null | undefined)?.toMillis()
      return publicAt !== undefined && Date.now() >= publicAt
    }
    return false
  }
  if (track.visibility === 'followers') {
    const follow = await db.collection('follows').doc(`${uid}_${track.artistId}`).get()
    return follow.exists || isActiveSupporter(uid, track.artistId)
  }
  if (track.visibility === 'supporters') {
    return isActiveSupporter(uid, track.artistId)
  }
  if (track.visibility === 'early_access') {
    if (await isActiveSupporter(uid, track.artistId)) return true
    const publicAt = (track.publicReleaseAt as FirebaseFirestore.Timestamp | null | undefined)?.toMillis()
    if (publicAt !== undefined && Date.now() >= publicAt) return true
    const followerAt = (track.followerReleaseAt as FirebaseFirestore.Timestamp | null | undefined)?.toMillis()
    if (followerAt !== undefined && Date.now() >= followerAt) {
      return (await db.collection('follows').doc(`${uid}_${track.artistId}`).get()).exists
    }
    return false
  }
  return false
}

/**
 * Returns the validated YouTube video ID only after checking current track
 * visibility and moderation state — this is the one place the app ever
 * discloses a track's YouTube link to a viewer who isn't its owner/admin.
 * The video ID itself lives in trackMedia/{trackId}, a doc that is never
 * client-readable — see firestore.rules for why it can't simply live on the
 * public tracks/{trackId} doc.
 */
export const getTrackYoutubeInfo = onCall(async (request) => {
  const trackId = request.data?.trackId as string | undefined
  if (!trackId) throw new HttpsError('invalid-argument', 'trackId is required.')
  const snap = await db.collection('tracks').doc(trackId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'Track does not exist.')
  const track = snap.data()!
  const uid = request.auth?.uid ?? null
  if (!(await canAccessTrackYoutubeLink(uid, track))) {
    throw new HttpsError('permission-denied', 'You do not have access to this track.')
  }
  const mediaSnap = await db.collection('trackMedia').doc(trackId).get()
  const youtubeVideoId = mediaSnap.data()?.youtubeVideoId
  if (typeof youtubeVideoId !== 'string' || !isValidYoutubeVideoId(youtubeVideoId)) {
    throw new HttpsError('failed-precondition', 'This track has no valid YouTube link.')
  }
  return { youtubeVideoId, youtubeUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}` }
})

/**
 * The only way a track is ever created. Runs every check firestore.rules
 * used to run on a direct client write, plus the one thing rules can't do:
 * atomically writing the public tracks/{trackId} doc and the
 * never-client-readable trackMedia/{trackId} doc (the actual video ID)
 * together, so a track never briefly exists without its media record.
 */
export const createTrack = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const data = request.data ?? {}

  const trackId = data.trackId as string | undefined
  const youtubeVideoId = data.youtubeVideoId as string | undefined
  const title = data.title as string | undefined
  const genre = data.genre as string | undefined
  if (!trackId || typeof trackId !== 'string') throw new HttpsError('invalid-argument', 'trackId is required.')
  if (!youtubeVideoId || !isValidYoutubeVideoId(youtubeVideoId)) {
    throw new HttpsError('invalid-argument', 'A valid YouTube video ID is required.')
  }
  if (!title || typeof title !== 'string' || !title.trim()) throw new HttpsError('invalid-argument', 'A title is required.')
  if (!genre || typeof genre !== 'string') throw new HttpsError('invalid-argument', 'A genre is required.')
  if (data.rightsConfirmed !== true) throw new HttpsError('invalid-argument', 'Rights confirmation is required.')

  const existing = await db.collection('tracks').doc(trackId).get()
  if (existing.exists) throw new HttpsError('already-exists', 'This track already exists.')

  if (!(await getRoles(uid)).includes('artist')) throw new HttpsError('permission-denied', 'An artist role is required.')

  const artistProfileSnap = await db.collection('artistProfiles').doc(uid).get()
  if (!artistProfileSnap.exists) throw new HttpsError('failed-precondition', 'An artist profile is required.')
  if ((artistProfileSnap.data()?.trackCount ?? 0) >= 10) {
    throw new HttpsError('failed-precondition', 'Your account can list up to 10 tracks. Remove an existing track before adding another.')
  }

  const membershipSnap = await db.collection('subscriptions').doc(`${uid}_artist`).get()
  const membershipStatus = membershipSnap.data()?.status
  if (membershipStatus !== 'active' && membershipStatus !== 'trialing') {
    throw new HttpsError('failed-precondition', 'An active Artist Membership is required to publish tracks.')
  }

  const visibility = typeof data.visibility === 'string' ? data.visibility : 'followers'
  const now = FieldValue.serverTimestamp()
  const toTimestamp = (value: unknown): Timestamp | null => {
    if (typeof value !== 'string' || !value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed)
  }
  const batch = db.batch()
  batch.set(db.collection('tracks').doc(trackId), {
    trackId,
    artistId: uid,
    title: title.trim(),
    titleLower: title.trim().toLowerCase(),
    ...(typeof data.trackSlug === 'string' && data.trackSlug ? { trackSlug: data.trackSlug } : {}),
    albumId: data.albumId ?? null,
    genre,
    subgenre: data.subgenre ?? null,
    bpm: data.bpm ?? null,
    mood: data.mood ?? null,
    key: data.key ?? null,
    location: data.location ?? null,
    releaseDate: now,
    description: typeof data.description === 'string' ? data.description : '',
    explicit: data.explicit === true,
    credits: {
      songwriters: Array.isArray(data.credits?.songwriters) ? data.credits.songwriters : [],
      producers: Array.isArray(data.credits?.producers) ? data.credits.producers : [],
      featuredArtists: Array.isArray(data.credits?.featuredArtists) ? data.credits.featuredArtists : [],
    },
    artworkURL: typeof data.artworkURL === 'string' ? data.artworkURL : null,
    visibility,
    djPromotion: data.djPromotion === true,
    djLicenceMode: typeof data.djLicenceMode === 'string' ? data.djLicenceMode : 'not_available',
    djFixedPrice: typeof data.djFixedPrice === 'number' ? data.djFixedPrice : null,
    djPromoTier: 'all',
    embargoUntil: toTimestamp(data.embargoUntil),
    followerReleaseAt: visibility === 'early_access' ? toTimestamp(data.followerReleaseAt) : null,
    publicReleaseAt: visibility === 'early_access' ? toTimestamp(data.publicReleaseAt) : null,
    playCount: 0,
    createdAt: now,
    updatedAt: now,
    rightsConfirmed: true,
    status: 'published',
    rightsMetadata: data.rightsMetadata ?? null,
  })
  batch.set(db.collection('trackMedia').doc(trackId), {
    youtubeVideoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
  })
  // Incremented in the same atomic batch as the track write itself, rather than relying on a
  // separate onDocumentCreated trigger — a trigger delivery gap left this permanently at 0 for
  // at least one account with a real, live track (user-reported: "i have uploaded a track but
  // the allowance still says 0 of 10", confirmed still 0 even in a fresh private-window session
  // after the earlier live-badge display fix).
  batch.update(db.collection('artistProfiles').doc(uid), { trackCount: FieldValue.increment(1) })
  await batch.commit()
  return { ok: true, trackId }
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

  // Only artwork is ever stored on our side now — no hosted audio to clean up.
  await getStorage().bucket().deleteFiles({ prefix: `artists/${track.artistId}/artwork/${trackId}.` })

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
  const deleteBatch = db.batch()
  deleteBatch.delete(db.collection('trackMedia').doc(trackId))
  deleteBatch.delete(ref)
  deleteBatch.update(db.collection('artistProfiles').doc(track.artistId), { trackCount: FieldValue.increment(-1) })
  await deleteBatch.commit()
  return { ok: true }
})

/**
 * Counts a real YouTube-link open only after the same entitlement check as
 * getTrackYoutubeInfo passes — this is an analytics counter
 * (section 46: "YouTube clicks"), never a claimed YouTube view count, and
 * never client-writable (firestore.rules freezes playCount).
 */
export const recordTrackPlay = onCall(async (request) => {
  const trackId = request.data?.trackId as string | undefined
  if (!trackId) throw new HttpsError('invalid-argument', 'trackId is required.')
  await enforceRateLimit(`recordTrackPlay_${trackId}`, 120, 60)

  const ref = db.collection('tracks').doc(trackId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Track does not exist.')
  }
  const track = snap.data()!
  const uid = request.auth?.uid ?? null
  if (!(await canAccessTrackYoutubeLink(uid, track))) {
    throw new HttpsError('permission-denied', 'This playback event is not authorised.')
  }

  await ref.update({ playCount: FieldValue.increment(1) })

  // A real, server-recorded "this fan opened this artist's track recently"
  // signal — the only thing onFollowCreate/onSupportRelationshipCreate
  // trust to count a genuine listen -> follow/support conversion.
  if (uid && uid !== track.artistId) {
    await db.collection('previewSessions').doc(`${uid}_${track.artistId}`).set({
      uid,
      artistId: track.artistId,
      lastPreviewAt: FieldValue.serverTimestamp(),
    })
  }
  return { ok: true }
})
