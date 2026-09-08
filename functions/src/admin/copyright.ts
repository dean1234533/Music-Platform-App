import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import { requireAdmin, writeAuditLog } from './guard.js'
import { enforceRateLimit } from '../rateLimit.js'

const CLAIM_STATUSES = [
  'under_review',
  'information_required',
  'artist_notified',
  'temporarily_restricted',
  'removed',
  'rejected',
  'resolved',
  'restored',
] as const

const RESTRICTABLE_CAPABILITIES = ['dj_licensing', 'discovery', 'streaming'] as const

/**
 * Anyone can file a claim — uploading a track never makes an artist a
 * "confirmed rights holder"; that determination is an admin review step,
 * not an automatic consequence of the upload form's checkbox. claimId is
 * generated client-side (same convention as newTrackId/newPostId) so
 * evidence can be uploaded to its Storage path before this call happens.
 */
export const submitCopyrightClaim = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  await enforceRateLimit(`submitCopyrightClaim_${request.auth.uid}`, 5, 60 * 60)
  const {
    claimId,
    trackId,
    reason,
    description,
    claimantName,
    claimantEmail,
    claimantCompany,
    claimantIsOwnerOrRep,
    claimedRights,
    supportingLinks,
    evidenceUrls,
    declarationSignature,
  } = request.data ?? {}
  if (!claimId || typeof claimId !== 'string') throw new HttpsError('invalid-argument', 'claimId is required.')
  if (!trackId || !reason) throw new HttpsError('invalid-argument', 'trackId and reason are required.')
  if (!claimantName || !claimantEmail || !declarationSignature) {
    throw new HttpsError('invalid-argument', 'Claimant name, email, and a declaration signature are required.')
  }
  if (claimantIsOwnerOrRep !== true) {
    throw new HttpsError('invalid-argument', 'You must confirm you are the rights owner or an authorised representative.')
  }

  const trackSnap = await db.collection('tracks').doc(trackId).get()
  if (!trackSnap.exists) throw new HttpsError('not-found', 'Track not found.')

  const claimRef = db.collection('copyrightClaims').doc(claimId)
  const existing = await claimRef.get()
  if (existing.exists) throw new HttpsError('already-exists', 'This claim has already been submitted.')

  await claimRef.set({
    claimId,
    reporterId: request.auth.uid,
    trackId,
    artistId: trackSnap.data()!.artistId,
    reason,
    description: description ?? '',
    status: 'submitted',
    claimantName,
    claimantEmail,
    claimantCompany: claimantCompany ?? null,
    claimantIsOwnerOrRep: true,
    claimedRights: claimedRights ?? null,
    supportingLinks: Array.isArray(supportingLinks) ? supportingLinks.slice(0, 10) : [],
    evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls.slice(0, 10) : [],
    declarationSignature,
    declaredAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  })

  return { claimId }
})

export const reviewCopyrightClaim = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { claimId, status, adminNote, restrictedCapabilities } = request.data ?? {}
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

  const trackRef = db.collection('tracks').doc(claim.trackId)
  const payoutHoldRef = db.collection('payoutHolds').doc(claim.artistId)

  if (status === 'removed') {
    batch.update(trackRef, { visibility: 'private', takenDown: true, restrictedCapabilities: [] })
    batch.set(payoutHoldRef, {
      artistId: claim.artistId,
      active: true,
      reason: `Copyright claim ${claimId} — track removed`,
      relatedClaimId: claimId,
      setBy: adminId,
      setAt: FieldValue.serverTimestamp(),
      clearedAt: null,
    })
  } else if (status === 'temporarily_restricted') {
    const cleaned = Array.isArray(restrictedCapabilities)
      ? restrictedCapabilities.filter((c: string) => (RESTRICTABLE_CAPABILITIES as readonly string[]).includes(c))
      : []
    batch.update(trackRef, { restrictedCapabilities: cleaned })
  } else if (status === 'restored') {
    batch.update(trackRef, { takenDown: false, restrictedCapabilities: [] })
    batch.set(
      payoutHoldRef,
      { active: false, clearedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
  } else if (status === 'rejected' || status === 'resolved') {
    batch.update(trackRef, { restrictedCapabilities: [] })
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

/** The artist's chance to respond to a claim affecting their music with explanation/evidence. */
export const submitArtistResponse = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const { claimId, response } = request.data ?? {}
  if (!claimId || typeof response !== 'string' || !response.trim()) {
    throw new HttpsError('invalid-argument', 'claimId and a response are required.')
  }

  const claimRef = db.collection('copyrightClaims').doc(claimId)
  const claimSnap = await claimRef.get()
  if (!claimSnap.exists) throw new HttpsError('not-found', 'Claim not found.')
  const claim = claimSnap.data()!
  if (claim.artistId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not the artist on this claim.')

  await claimRef.update({
    artistResponse: response.trim(),
    artistRespondedAt: FieldValue.serverTimestamp(),
    status: 'artist_notified',
  })

  return { ok: true }
})

/**
 * A shallow counter-notice/appeal — a text statement plus a status flip so
 * admins see it in the review queue. Not a formal legal counter-notice
 * process; flagged for solicitor review same as the rest of the copyright
 * wording. Only usable once a claim has actually gone against the artist.
 */
export const submitCounterNotice = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const { claimId, counterNoticeText } = request.data ?? {}
  if (!claimId || typeof counterNoticeText !== 'string' || !counterNoticeText.trim()) {
    throw new HttpsError('invalid-argument', 'claimId and counterNoticeText are required.')
  }

  const claimRef = db.collection('copyrightClaims').doc(claimId)
  const claimSnap = await claimRef.get()
  if (!claimSnap.exists) throw new HttpsError('not-found', 'Claim not found.')
  const claim = claimSnap.data()!
  if (claim.artistId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not the artist on this claim.')
  if (!['removed', 'temporarily_restricted'].includes(claim.status)) {
    throw new HttpsError('failed-precondition', 'A counter-notice can only be filed once a claim has resulted in removal or restriction.')
  }

  await claimRef.update({
    counterNoticeText: counterNoticeText.trim(),
    counterNoticeSubmittedAt: FieldValue.serverTimestamp(),
    status: 'counter_noticed',
  })

  return { ok: true }
})
