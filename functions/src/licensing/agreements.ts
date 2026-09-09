import { createHash } from 'node:crypto'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import type { WriteBatch, DocumentReference, DocumentData } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import { writeSystemMessage } from '../messaging/messages.js'
import { writeRequestEvent } from './events.js'
import { resolveLicencePartyRole } from './party.js'

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
  source: { acceptedOfferId?: string | null; sourceDealId?: string | null } = {},
): Promise<{ agreementRef: DocumentReference; version: number; editedInPlace: boolean }> {
  let version = 1
  let previousRef: DocumentReference | null = null

  if (licenceRequest.currentAgreementId) {
    previousRef = db.collection('licenceAgreements').doc(licenceRequest.currentAgreementId)
    const previousSnap = await previousRef.get()
    if (previousSnap.exists) {
      const previous = previousSnap.data()!
      version = previous.agreementVersion + 1
    }
  }

  const contentHash = computeContentHash(terms)

  const agreementRef = db.collection('licenceAgreements').doc()
  if (previousRef) {
    batch.update(previousRef, { status: 'void', downloadRevoked: true, updatedAt: FieldValue.serverTimestamp() })
  }

  batch.set(agreementRef, {
    agreementId: agreementRef.id,
    requestId: requestRef.id,
    licenceRequestId: requestRef.id,
    artistId: licenceRequest.artistId,
    djId: licenceRequest.djId,
    trackId: licenceRequest.trackId,
    trackVersion: 1,
    acceptedOfferId: source.acceptedOfferId ?? null,
    sourceDealId: source.sourceDealId ?? null,
    trackTitleSnapshot: licenceRequest.trackTitleSnapshot ?? 'Track',
    artistNameSnapshot: licenceRequest.artistNameSnapshot ?? 'Artist',
    djNameSnapshot: licenceRequest.djNameSnapshot ?? 'DJ',
    ...terms,
    contentHash,
    agreementVersion: version,
    status: 'ready_for_signature',
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

/** Retired callable retained only to give older clients a safe, explicit error. */
export const proposeAgreement = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  throw new HttpsError('failed-precondition', 'Use the structured offer and counter-offer flow to create an agreement.')
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
  const { agreementId, agreementVersion, contentHash, agreedToTerms, legalName, signatureType, signatureReference, authorityConfirmed, actingRole: requestedRole } = request.data ?? {}
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

  if (!['pending', 'ready_for_signature', 'artist_signed', 'dj_signed'].includes(agreement.status)) {
    throw new HttpsError('failed-precondition', 'This agreement is no longer awaiting signatures.')
  }
  if (agreementVersion !== agreement.agreementVersion || contentHash !== agreement.contentHash) {
    throw new HttpsError('failed-precondition', 'The agreement changed before signing. Reload and review the current version.')
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

  const actingRole = resolveLicencePartyRole(agreement, uid, requestedRole)
  const isArtist = actingRole === 'artist'
  if (isArtist && agreement.artistAcceptedAt) throw new HttpsError('failed-precondition', 'The artist has already signed.')
  if (!isArtist && agreement.djAcceptedAt) throw new HttpsError('failed-precondition', 'The DJ has already signed.')

  const requestRef = db.collection('licenceRequests').doc(agreement.licenceRequestId)
  const requestSnap = await requestRef.get()
  const conversationId = requestSnap.data()?.conversationId as string | undefined
  const conversationRef = conversationId ? db.collection('conversations').doc(conversationId) : null

  const now = FieldValue.serverTimestamp()
  const acceptanceLogRef = db.collection('licenceAgreementAcceptances').doc(`${agreementId}_${actingRole}_${uid}`)

  const update: Record<string, unknown> = { updatedAt: now, status: isArtist ? 'artist_signed' : 'dj_signed' }
  if (isArtist) {
    update.artistAcceptedAt = now
    update.artistLegalName = legalName.trim()
  }
  if (!isArtist) {
    update.djAcceptedAt = now
    update.djLegalName = legalName.trim()
  }

  const bothWillBeAccepted = isArtist
    ? Boolean(agreement.djAcceptedAt)
    : Boolean(agreement.artistAcceptedAt)

  const batch = db.batch()
  batch.update(agreementRef, update)
  batch.create(acceptanceLogRef, {
    acceptanceId: acceptanceLogRef.id,
    signatureId: acceptanceLogRef.id,
    agreementId,
    userId: uid,
    signerUserId: uid,
    role: actingRole,
    signerRole: actingRole,
    legalName: legalName.trim(),
    signatureType,
    signatureReference,
    authorityConfirmed: true,
    agreementVersion: agreement.agreementVersion,
    agreementContentHash: agreement.contentHash ?? null,
    contentHash: agreement.contentHash ?? null,
    // Best-effort — v2 onCall exposes rawRequest, but it may be absent in
    // some execution contexts (e.g. the emulator); never fail signing over it.
    ipAddress: request.rawRequest?.ip ?? null,
    userAgent: request.rawRequest?.get?.('user-agent') ?? null,
    acceptedAt: now,
    signedAt: now,
  })
  writeRequestEvent(batch, requestRef, {
    type: isArtist ? 'artist_signed' : 'dj_signed',
    actorId: uid,
    actorRole: actingRole,
    summary: `${isArtist ? 'Artist' : 'DJ'} signed the agreement.`,
    agreementId,
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
    writeRequestEvent(batch, requestRef, {
      type: requiresPayment ? 'payment_required' : 'licence_active',
      actorId: null,
      actorRole: 'system',
      summary: requiresPayment ? 'Both parties signed. Payment is required.' : 'Both parties signed. The licence is active.',
      agreementId,
    })
    if (requiresPayment) {
      // Payment is always the DJ's action, regardless of which party's signature just completed
      // the pair — the DJ needs this notification either way, not "whoever didn't just sign".
      batch.set(db.collection('notifications').doc(), {
        userId: agreement.djId,
        type: 'payment_required',
        title: 'Agreement signed — payment required',
        body: 'Both parties signed. Complete payment to unlock the download.',
        linkTo: `/agreements/${agreementId}?as=dj`,
        read: false,
        createdAt: now,
      })
      // If the DJ was the one who just signed (finalising the pair), the artist hasn't been told yet.
      if (!isArtist) {
        batch.set(db.collection('notifications').doc(), {
          userId: agreement.artistId,
          type: 'dj_signed',
          title: 'DJ signed — awaiting payment',
          body: 'Both parties have now signed. The licence activates once the DJ completes payment.',
          linkTo: `/agreements/${agreementId}?as=artist`,
          read: false,
          createdAt: now,
        })
      }
    } else {
      const notifyId = isArtist ? agreement.djId : agreement.artistId
      batch.set(db.collection('notifications').doc(), {
        userId: notifyId,
        type: 'download_unlocked',
        title: 'Agreement signed — download unlocked',
        body: 'Both parties signed. The full-quality track is now available to download.',
        linkTo: `/agreements/${agreementId}?as=${isArtist ? 'dj' : 'artist'}`,
        read: false,
        createdAt: now,
      })
    }
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
      linkTo: `/agreements/${agreementId}?as=${isArtist ? 'dj' : 'artist'}`,
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
  const { agreementId, reason, actingRole: requestedRole } = request.data ?? {}
  if (!agreementId || typeof agreementId !== 'string') throw new HttpsError('invalid-argument', 'agreementId is required.')

  const agreementRef = db.collection('licenceAgreements').doc(agreementId)
  const snap = await agreementRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Agreement not found.')
  const agreement = snap.data()!

  const actingRole = resolveLicencePartyRole(agreement, uid, requestedRole)
  const isArtist = actingRole === 'artist'
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
  writeRequestEvent(batch, requestRef, {
    type: 'agreement_voided', actorId: uid, actorRole: actingRole,
    summary: `${isArtist ? 'Artist' : 'DJ'} voided the agreement.`, agreementId,
  })

  const notifyId = isArtist ? agreement.djId : agreement.artistId
  batch.set(db.collection('notifications').doc(), {
    userId: notifyId,
    type: 'agreement_voided',
    title: 'Licence agreement voided',
    body: `${isArtist ? 'The artist' : 'The DJ'} voided this licence agreement. Any download access has been revoked.`,
    linkTo: `/agreements/${agreementId}?as=${isArtist ? 'dj' : 'artist'}`,
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
