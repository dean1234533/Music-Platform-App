import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'

const CLAIM_STATUSES = ['under_review', 'action_required', 'removed', 'restored', 'rejected'] as const

/**
 * Anyone can file a claim — uploading a track never makes an artist a
 * "confirmed rights holder"; that determination is an admin review step,
 * not an automatic consequence of the upload form's checkbox.
 */
export const submitCopyrightClaim = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const { trackId, reason, description } = request.data ?? {}
  if (!trackId || !reason) throw new HttpsError('invalid-argument', 'trackId and reason are required.')

  const trackSnap = await db.collection('tracks').doc(trackId).get()
  if (!trackSnap.exists) throw new HttpsError('not-found', 'Track not found.')

  const claimRef = db.collection('copyrightClaims').doc()
  await claimRef.set({
    claimId: claimRef.id,
    reporterId: request.auth.uid,
    trackId,
    artistId: trackSnap.data()!.artistId,
    reason,
    description: description ?? '',
    status: 'submitted',
    createdAt: FieldValue.serverTimestamp(),
  })

  return { claimId: claimRef.id }
})

export const reviewCopyrightClaim = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { claimId, status, adminNote } = request.data ?? {}
  if (!claimId || !CLAIM_STATUSES.includes(status)) {
    throw new HttpsError('invalid-argument', 'claimId and a valid status are required.')
  }

  const claimRef = db.collection('copyrightClaims').doc(claimId)
  const claimSnap = await claimRef.get()
  if (!claimSnap.exists) throw new HttpsError('not-found', 'Claim not found.')
  const claim = claimSnap.data()!

  const batch = db.batch()
  batch.update(claimRef, {
    status,
    adminNote: adminNote ?? null,
    reviewedBy: adminId,
    reviewedAt: FieldValue.serverTimestamp(),
  })

  if (status === 'removed') {
    batch.update(db.collection('tracks').doc(claim.trackId), { visibility: 'private', takenDown: true })
  } else if (status === 'restored') {
    batch.update(db.collection('tracks').doc(claim.trackId), { takenDown: false })
  }

  batch.set(db.collection('notifications').doc(), {
    userId: claim.artistId,
    type: 'copyright_claim_update',
    title: 'Copyright claim update',
    body: `A copyright claim on your track is now "${status}".`,
    linkTo: '/dashboard/artist/music',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
  await writeAuditLog(adminId, 'review_copyright_claim', { claimId, status, trackId: claim.trackId })

  return { ok: true }
})
