import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'
import { enforceRateLimit } from './rateLimit.js'

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
