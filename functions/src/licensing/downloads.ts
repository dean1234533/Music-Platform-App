import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { db } from '../admin.js'
import { requireActiveUser, userHasRole } from '../roles.js'

const SIGNED_URL_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * The only way a full-quality original ever reaches a DJ. Re-checks every
 * condition from the spec server-side — auth, role, agreement ownership,
 * track match, approval, payment, expiry, and revocation — before issuing a
 * short-lived signed URL. Storage rules independently block public/direct
 * reads of originals, so this function is the sole path to the file.
 */
export const getSecureDownloadUrl = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const djId = request.auth.uid
  const { agreementId } = request.data ?? {}
  if (!agreementId || typeof agreementId !== 'string') {
    throw new HttpsError('invalid-argument', 'agreementId is required.')
  }

  if (!(await userHasRole(djId, 'dj'))) {
    throw new HttpsError('permission-denied', 'A DJ profile is required to download licensed tracks.')
  }

  const agreementRef = db.collection('licenceAgreements').doc(agreementId)
  const agreementSnap = await agreementRef.get()
  if (!agreementSnap.exists) throw new HttpsError('not-found', 'Agreement not found.')
  const agreement = agreementSnap.data()!

  if (agreement.djId !== djId) {
    throw new HttpsError('permission-denied', 'This agreement does not belong to you.')
  }
  if (agreement.status !== 'active') {
    throw new HttpsError('failed-precondition', 'Agreement is not active.')
  }
  if (agreement.legalHold) {
    throw new HttpsError('permission-denied', 'This agreement is under legal hold.')
  }
  if (agreement.downloadRevoked) {
    throw new HttpsError('permission-denied', 'Download access has been revoked.')
  }
  const requiresPayment = (agreement.licenceFeeMinor ?? 0) > 0
  if (requiresPayment && !agreement.paidAt) {
    throw new HttpsError('failed-precondition', 'Payment has not been completed.')
  }
  if (agreement.expiryDate) {
    const expiry = new Date(agreement.expiryDate as string)
    if (expiry.getTime() < Date.now()) {
      throw new HttpsError('failed-precondition', 'This licence has expired.')
    }
  }

  const trackSnap = await db.collection('tracks').doc(agreement.trackId).get()
  if (!trackSnap.exists) throw new HttpsError('not-found', 'Track not found.')
  const track = trackSnap.data()!
  if (track.artistId !== agreement.artistId) {
    throw new HttpsError('failed-precondition', 'Track/artist mismatch on this agreement.')
  }
  if (track.takenDown === true || (track.restrictedCapabilities ?? []).includes('dj_licensing')) {
    throw new HttpsError('permission-denied', 'This track is under a copyright review — downloads are temporarily unavailable. Your signed agreement record is preserved.')
  }

  const bucket = getStorage().bucket()
  const file = bucket.file(track.originalAudioPath as string)
  const [exists] = await file.exists()
  if (!exists) throw new HttpsError('not-found', 'Original file is unavailable.')

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
  })

  await Promise.all([
    agreementRef.update({ downloadCount: FieldValue.increment(1) }),
    db.collection('downloadLogs').add({
      djId,
      artistId: agreement.artistId,
      trackId: agreement.trackId,
      agreementId,
      fileVersion: agreement.trackVersion ?? 1,
      timestamp: FieldValue.serverTimestamp(),
    }),
  ])

  return { url, expiresInSeconds: SIGNED_URL_TTL_MS / 1000 }
})
