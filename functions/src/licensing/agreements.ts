import { createHash } from 'node:crypto'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import type { WriteBatch, DocumentReference, DocumentData } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import { writeSystemMessage } from '../messaging/messages.js'

/** Deterministic fingerprint of the agreed terms — a signature records the exact contentHash it was given for, so any (impossible, since writes are server-only) tampering after signing would be independently detectable. */
export function computeContentHash(terms: AgreementTerms): string {
  const canonical = Object.keys(terms)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = terms[key as keyof AgreementTerms]
      return acc
    }, {})
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

export interface AgreementTerms {
  permittedUse: string
  territory: string
  startDate: string
  expiryDate: string | null
  licenceFeeMinor: number
  currency: string
  attributionRequirements: string
  recordingPermission: boolean
  streamingPermission: boolean
  promotionalMixPermission: boolean
  commercialUse: boolean
  redistributionAllowed: boolean
  resaleAllowed: boolean
  remixAllowed: boolean
  additionalTerms: string
  rightsHolderDeclaration: boolean
}

/**
 * Shared "create or version" logic for turning agreed terms into a contract
 * record — used by both the legacy proposeAgreement (freeform artist edit)
 * and acceptOffer (sourced from an accepted offer's frozen fields). If the
 * request's current agreement hasn't been accepted by anyone yet, it's
 * edited in place; otherwise a new version is created and the old one is
 * marked superseded. Signed agreements are never mutated by this path.
 */
export async function writeAgreementVersion(
  batch: WriteBatch,
  requestRef: DocumentReference,
  licenceRequest: DocumentData,
  terms: AgreementTerms,
): Promise<{ agreementRef: DocumentReference; version: number; editedInPlace: boolean }> {
  let version = 1
  let previousRef: DocumentReference | null = null
  let editInPlaceRef: DocumentReference | null = null

  if (licenceRequest.currentAgreementId) {
    previousRef = db.collection('licenceAgreements').doc(licenceRequest.currentAgreementId)
    const previousSnap = await previousRef.get()
    if (previousSnap.exists) {
      const previous = previousSnap.data()!
      if (!previous.artistAcceptedAt && !previous.djAcceptedAt) {
        editInPlaceRef = previousRef
        version = previous.agreementVersion
      } else {
        version = previous.agreementVersion + 1
      }
    }
  }

  const contentHash = computeContentHash(terms)

  if (editInPlaceRef) {
    batch.update(editInPlaceRef, { ...terms, contentHash, updatedAt: FieldValue.serverTimestamp() })
    batch.update(requestRef, { status: 'agreement_ready', currentAgreementId: editInPlaceRef.id, updatedAt: FieldValue.serverTimestamp() })
    return { agreementRef: editInPlaceRef, version, editedInPlace: true }
  }

  const agreementRef = db.collection('licenceAgreements').doc()
  if (previousRef) {
    batch.update(previousRef, { status: 'superseded', updatedAt: FieldValue.serverTimestamp() })
  }

  batch.set(agreementRef, {
    agreementId: agreementRef.id,
    licenceRequestId: requestRef.id,
    artistId: licenceRequest.artistId,
    djId: licenceRequest.djId,
    trackId: licenceRequest.trackId,
    trackVersion: 1,
    ...terms,
    contentHash,
    agreementVersion: version,
    status: 'pending',
    artistAcceptedAt: null,
    djAcceptedAt: null,
    artistLegalName: null,
    djLegalName: null,
    paidAt: null,
    downloadRevoked: false,
    downloadCount: 0,
    legalHold: false,
    createdAt: FieldValue.serverTimestamp(),
    finalisedAt: null,
  })

  batch.update(requestRef, {
    status: 'agreement_ready',
    currentAgreementId: agreementRef.id,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return { agreementRef, version, editedInPlace: false }
}

interface ProposeAgreementInput {
  requestId: string
  permittedUse: string
  territory: string
  startDate: string
  expiryDate: string | null
  licenceFeeMinor: number
  currency: string
  attributionRequirements: string
  recordingPermission: boolean
  streamingPermission: boolean
  commercialUse: boolean
  redistributionAllowed: boolean
  resaleAllowed: boolean
  additionalTerms: string
}

/**
 * Legacy freeform "artist edits terms directly" path — kept working but no
 * longer surfaced in the UI, which now goes through the offer/counter-offer
 * flow (sendOffer/counterOffer/acceptOffer in offers.ts) that funnels into
 * the same writeAgreementVersion() helper above.
 */
export const proposeAgreement = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const input = request.data as ProposeAgreementInput
  if (!input?.requestId) throw new HttpsError('invalid-argument', 'requestId is required.')

  const requestRef = db.collection('licenceRequests').doc(input.requestId)
  const requestSnap = await requestRef.get()
  if (!requestSnap.exists) throw new HttpsError('not-found', 'Licence request not found.')
  const licenceRequest = requestSnap.data()!

  if (licenceRequest.artistId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only the artist can propose licence terms.')
  }
  if (['approved', 'rejected', 'cancelled', 'expired'].includes(licenceRequest.status)) {
    throw new HttpsError('failed-precondition', 'This request is already finalised.')
  }

  const batch = db.batch()
  const { agreementRef, version } = await writeAgreementVersion(batch, requestRef, licenceRequest, {
    permittedUse: input.permittedUse,
    territory: input.territory,
    startDate: input.startDate,
    expiryDate: input.expiryDate,
    licenceFeeMinor: input.licenceFeeMinor,
    currency: input.currency,
    attributionRequirements: input.attributionRequirements,
    recordingPermission: input.recordingPermission,
    streamingPermission: input.streamingPermission,
    promotionalMixPermission: false,
    commercialUse: input.commercialUse,
    redistributionAllowed: input.redistributionAllowed,
    resaleAllowed: input.resaleAllowed,
    remixAllowed: false,
    additionalTerms: input.additionalTerms,
    rightsHolderDeclaration: true,
  })

  batch.set(db.collection('notifications').doc(), {
    userId: licenceRequest.djId,
    type: 'agreement_ready',
    title: 'Licence agreement ready',
    body: 'The artist sent you licence terms to review.',
    linkTo: '/dj/requests',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
  return { agreementId: agreementRef.id, agreementVersion: version }
})

/**
 * Explicit digital acceptance (checkbox + button), recorded server-side.
 * This is not a cryptographic signature — the app's copy is upfront that
 * it's recording agreement between the parties, with a note that final
 * legal wording should be reviewed professionally before production launch.
 */
export const signAgreement = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const { agreementId, agreedToTerms, legalName, signatureType, signatureReference, authorityConfirmed } = request.data ?? {}
  if (!agreementId || typeof agreementId !== 'string') throw new HttpsError('invalid-argument', 'agreementId is required.')
  if (agreedToTerms !== true) throw new HttpsError('invalid-argument', 'You must confirm you agree to the terms.')
  if (!legalName || typeof legalName !== 'string' || !legalName.trim()) {
    throw new HttpsError('invalid-argument', 'Your full legal name is required.')
  }
  if (signatureType !== 'typed' && signatureType !== 'drawn') {
    throw new HttpsError('invalid-argument', 'Invalid signatureType.')
  }
  if (!signatureReference || typeof signatureReference !== 'string') {
    throw new HttpsError('invalid-argument', 'signatureReference is required.')
  }
  if (authorityConfirmed !== true) {
    throw new HttpsError('invalid-argument', 'You must confirm you have authority to enter into this agreement.')
  }

  const agreementRef = db.collection('licenceAgreements').doc(agreementId)
  const snap = await agreementRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Agreement not found.')
  const agreement = snap.data()!

  if (agreement.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This agreement is no longer awaiting signatures.')
  }

  // Integrity check: recompute the content hash from the agreement's current
  // fields and compare against the hash frozen at generation time. Every
  // write path is server-only, so this can't be defeated by a client — it's
  // a last line of defense against a future code change accidentally
  // mutating terms in place after generation, catching it before a
  // signature is ever attached to changed content. Older agreements
  // (created before contentHash existed) have nothing to compare against
  // and are skipped, not treated as failing the check.
  if (agreement.contentHash) {
    const recomputed = computeContentHash({
      permittedUse: agreement.permittedUse,
      territory: agreement.territory,
      startDate: agreement.startDate,
      expiryDate: agreement.expiryDate,
      licenceFeeMinor: agreement.licenceFeeMinor,
      currency: agreement.currency,
      attributionRequirements: agreement.attributionRequirements,
      recordingPermission: agreement.recordingPermission,
      streamingPermission: agreement.streamingPermission,
      promotionalMixPermission: agreement.promotionalMixPermission,
      commercialUse: agreement.commercialUse,
      redistributionAllowed: agreement.redistributionAllowed,
      resaleAllowed: agreement.resaleAllowed,
      remixAllowed: agreement.remixAllowed,
      additionalTerms: agreement.additionalTerms,
      rightsHolderDeclaration: agreement.rightsHolderDeclaration,
    })
    if (recomputed !== agreement.contentHash) {
      throw new HttpsError('failed-precondition', 'This agreement could not be verified. Please contact support.')
    }
  }

  const isArtist = agreement.artistId === uid
  const isDj = agreement.djId === uid
  if (!isArtist && !isDj) throw new HttpsError('permission-denied', 'Not a party to this agreement.')
  if (isArtist && agreement.artistAcceptedAt) throw new HttpsError('failed-precondition', 'Already signed.')
  if (isDj && agreement.djAcceptedAt) throw new HttpsError('failed-precondition', 'Already signed.')

  const requestRef = db.collection('licenceRequests').doc(agreement.licenceRequestId)
  const requestSnap = await requestRef.get()
  const conversationId = requestSnap.data()?.conversationId as string | undefined
  const conversationRef = conversationId ? db.collection('conversations').doc(conversationId) : null

  const now = FieldValue.serverTimestamp()
  const acceptanceLogRef = db.collection('licenceAgreementAcceptances').doc()

  const update: Record<string, unknown> = { updatedAt: now }
  if (isArtist) {
    update.artistAcceptedAt = now
    update.artistLegalName = legalName.trim()
  }
  if (isDj) {
    update.djAcceptedAt = now
    update.djLegalName = legalName.trim()
  }

  const bothWillBeAccepted = isArtist
    ? Boolean(agreement.djAcceptedAt)
    : Boolean(agreement.artistAcceptedAt)

  const batch = db.batch()
  batch.update(agreementRef, update)
  batch.set(acceptanceLogRef, {
    acceptanceId: acceptanceLogRef.id,
    agreementId,
    userId: uid,
    role: isArtist ? 'artist' : 'dj',
    legalName: legalName.trim(),
    signatureType,
    signatureReference,
    authorityConfirmed: true,
    agreementVersion: agreement.agreementVersion,
    agreementContentHash: agreement.contentHash ?? null,
    // Best-effort — v2 onCall exposes rawRequest, but it may be absent in
    // some execution contexts (e.g. the emulator); never fail signing over it.
    ipAddress: request.rawRequest?.ip ?? null,
    userAgent: request.rawRequest?.get?.('user-agent') ?? null,
    acceptedAt: now,
  })

  if (conversationRef) {
    writeSystemMessage(batch, conversationRef, uid, 'contract_status', `${isArtist ? 'Artist' : 'DJ'} signed the agreement.`, {
      agreementId,
    })
  }

  if (bothWillBeAccepted) {
    const requiresPayment = (agreement.licenceFeeMinor ?? 0) > 0
    batch.update(agreementRef, { status: requiresPayment ? 'awaiting_payment' : 'active', finalisedAt: now })
    batch.update(requestRef, {
      status: requiresPayment ? 'awaiting_payment' : 'approved',
      updatedAt: now,
    })
    const notifyId = isArtist ? agreement.djId : agreement.artistId
    batch.set(db.collection('notifications').doc(), {
      userId: notifyId,
      type: requiresPayment ? 'payment_required' : 'download_unlocked',
      title: requiresPayment ? 'Agreement signed — payment required' : 'Agreement signed — download unlocked',
      body: requiresPayment
        ? 'Both parties signed. Complete payment to unlock the download.'
        : 'Both parties signed. The full-quality track is now available to download.',
      linkTo: `/agreements/${agreementId}`,
      read: false,
      createdAt: now,
    })
    if (conversationRef) {
      writeSystemMessage(
        batch,
        conversationRef,
        uid,
        'contract_status',
        requiresPayment ? 'Contract fully signed — payment required.' : 'Contract fully signed — track access unlocked.',
        { agreementId },
      )
    }
  } else {
    const notifyId = isArtist ? agreement.djId : agreement.artistId
    batch.set(db.collection('notifications').doc(), {
      userId: notifyId,
      type: 'agreement_ready',
      title: `${isArtist ? 'Artist' : 'DJ'} signed the contract`,
      body: 'Review the final terms and add your signature to continue.',
      linkTo: `/agreements/${agreementId}`,
      read: false,
      createdAt: now,
    })
  }

  await batch.commit()
  return { ok: true, bothAccepted: bothWillBeAccepted }
})

/**
 * Either party can end a signed agreement — unilateral, not bilateral
 * consent, since requiring both parties to agree would leave no way out of
 * a dispute short of an admin. This is a platform-recorded cancellation for
 * the DJ↔artist relationship (revokes download access, freezes the
 * contract), not a substitute for whatever real-world legal/financial
 * remedy a voided licence might require between the parties — same
 * "pending qualified solicitor review" caveat as the rest of this system's
 * legal wording.
 */
export const voidAgreement = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const { agreementId, reason } = request.data ?? {}
  if (!agreementId || typeof agreementId !== 'string') throw new HttpsError('invalid-argument', 'agreementId is required.')

  const agreementRef = db.collection('licenceAgreements').doc(agreementId)
  const snap = await agreementRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Agreement not found.')
  const agreement = snap.data()!

  const isArtist = agreement.artistId === uid
  const isDj = agreement.djId === uid
  if (!isArtist && !isDj) throw new HttpsError('permission-denied', 'Not a party to this agreement.')
  if (agreement.legalHold) throw new HttpsError('failed-precondition', 'This agreement is under legal hold.')
  if (!['active', 'awaiting_payment'].includes(agreement.status)) {
    throw new HttpsError('failed-precondition', 'Only an active or awaiting-payment agreement can be voided.')
  }

  const requestRef = db.collection('licenceRequests').doc(agreement.licenceRequestId)
  const requestSnap = await requestRef.get()
  const conversationId = requestSnap.data()?.conversationId as string | undefined
  const conversationRef = conversationId ? db.collection('conversations').doc(conversationId) : null

  const now = FieldValue.serverTimestamp()
  const batch = db.batch()
  batch.update(agreementRef, {
    status: 'void',
    downloadRevoked: true,
    voidedBy: uid,
    voidedAt: now,
    voidReason: typeof reason === 'string' ? reason.slice(0, 500) : null,
  })
  batch.update(requestRef, { status: 'cancelled', updatedAt: now })

  const notifyId = isArtist ? agreement.djId : agreement.artistId
  batch.set(db.collection('notifications').doc(), {
    userId: notifyId,
    type: 'agreement_voided',
    title: 'Licence agreement voided',
    body: `${isArtist ? 'The artist' : 'The DJ'} voided this licence agreement. Any download access has been revoked.`,
    linkTo: '/dj/requests',
    read: false,
    createdAt: now,
  })
  if (conversationRef) {
    writeSystemMessage(
      batch,
      conversationRef,
      uid,
      'contract_status',
      `${isArtist ? 'Artist' : 'DJ'} voided the agreement${typeof reason === 'string' && reason ? `: ${reason.slice(0, 200)}` : '.'}`,
      { agreementId },
    )
  }

  await batch.commit()
  return { ok: true }
})
