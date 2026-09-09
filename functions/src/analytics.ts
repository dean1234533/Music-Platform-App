import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'
import { enforceRateLimit } from './rateLimit.js'

const MAX_REFERRAL_SOURCES = 20
const REF_PATTERN = /^[a-z0-9_-]{1,32}$/

function sanitizeRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null
  const lower = ref.toLowerCase()
  return REF_PATTERN.test(lower) ? lower : null
}

/**
 * Anonymous-friendly view counters for the public artist/track pages — most
 * visitors here are signed out, so this mirrors recordTrackPlay's callable
 * + coarse per-content rate limit pattern rather than a per-viewer dedup.
 * Real, server-recorded counts; not exact unique-visitor precision.
 */
export const recordProfileView = onCall(async (request) => {
  const artistId = request.data?.artistId as string | undefined
  if (!artistId || typeof artistId !== 'string') {
    throw new HttpsError('invalid-argument', 'artistId is required.')
  }
  await enforceRateLimit(`recordProfileView_${artistId}`, 120, 60)

  const ref = db.collection('artistProfiles').doc(artistId)
  const refSource = sanitizeRef(request.data?.ref)

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new HttpsError('not-found', 'Artist does not exist.')

    const update: Record<string, unknown> = { profileViews: FieldValue.increment(1) }
    if (refSource) {
      const existing = (snap.data()?.referralViews ?? {}) as Record<string, number>
      const bucket =
        existing[refSource] !== undefined || Object.keys(existing).length < MAX_REFERRAL_SOURCES ? refSource : 'other'
      update[`referralViews.${bucket}`] = FieldValue.increment(1)
    }
    tx.update(ref, update)
  })

  return { ok: true }
})

export const recordTrackView = onCall(async (request) => {
  const trackId = request.data?.trackId as string | undefined
  if (!trackId || typeof trackId !== 'string') {
    throw new HttpsError('invalid-argument', 'trackId is required.')
  }
  await enforceRateLimit(`recordTrackView_${trackId}`, 120, 60)

  const ref = db.collection('tracks').doc(trackId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Track does not exist.')

  await ref.update({ viewCount: FieldValue.increment(1) })
  return { ok: true }
})
