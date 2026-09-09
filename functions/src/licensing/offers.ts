import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { DocumentData } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import { writeSystemMessage } from '../messaging/messages.js'
import { writeAgreementVersion, type AgreementTerms } from './agreements.js'
import { writeRequestEvent } from './events.js'

interface OfferTermsInput {
  priceMinor: number
  currency: string
  permittedUse: string
  territory: string
  startDate: string
  expiryDate: string | null
  recordingPermission: boolean
  streamingPermission: boolean
  promotionalMixPermission: boolean
  attributionRequirements: string
  redistributionAllowed: boolean
  resaleAllowed: boolean
  remixAllowed: boolean
  additionalTerms: string
  /** Optional — how long this specific offer stays open for acceptance, distinct from the licence's own startDate/expiryDate. ISO date string or null. */
  offerExpiresAt?: string | null
}

function validateTerms(input: OfferTermsInput | undefined): asserts input is OfferTermsInput {
  if (!input || typeof input.priceMinor !== 'number' || input.priceMinor < 0 || !input.currency) {
    throw new HttpsError('invalid-argument', 'Valid offer terms are required.')
  }
}

const NEGOTIABLE_STATUSES = ['submitted', 'negotiating', 'offer_sent', 'counter_offer', 'agreement_ready']

async function loadNegotiableRequest(requestId: string, uid: string) {
  if (!requestId || typeof requestId !== 'string') throw new HttpsError('invalid-argument', 'requestId is required.')
  const requestRef = db.collection('licenceRequests').doc(requestId)
  const snap = await requestRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Request not found.')
  const licenceRequest = snap.data()!
  const isArtist = licenceRequest.artistId === uid
  const isDj = licenceRequest.djId === uid
  if (!isArtist && !isDj) throw new HttpsError('permission-denied', 'Not a participant in this request.')
  if (!NEGOTIABLE_STATUSES.includes(licenceRequest.status)) {
    throw new HttpsError('failed-precondition', 'This request is not open for offers.')
  }
  return { requestRef, licenceRequest, isArtist, isDj }
}

/**
 * Enforces the per-track djDealSettings that were previously stored but
 * never checked: a price floor (minimumPriceMinor) on any offer terms, and
 * A track price floor is always enforced. Opening the contract-terms form is
 * itself the artist's explicit approval of a manual-review request, so no
 * separate status-changing step is required first.
 */
async function enforceTrackDealSettings(
  trackId: string,
  priceMinor: number,
  isOpeningOffer: boolean,
  requestStatus: string,
): Promise<void> {
  const trackSnap = await db.collection('tracks').doc(trackId).get()
  const dealSettings = trackSnap.data()?.djDealSettings as
    | { minimumPriceMinor: number | null; customApprovalRequired: boolean }
    | undefined
  if (!dealSettings) return

  void isOpeningOffer
  void requestStatus
  if (typeof dealSettings.minimumPriceMinor === 'number' && priceMinor < dealSettings.minimumPriceMinor) {
    throw new HttpsError('invalid-argument', 'This offer is below the minimum price set for this track.')
  }
}

/** Only the artist can open a negotiation with the first offer. */
export const sendOffer = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const { requestId, ...terms } = request.data ?? {}
  validateTerms(terms)

  const { requestRef, licenceRequest, isArtist } = await loadNegotiableRequest(requestId, uid)
  if (!isArtist) throw new HttpsError('permission-denied', 'Only the artist can send the opening offer.')
  let reissueVersion = 1
  if (licenceRequest.currentOfferId) {
    const existingSnap = await db.collection('licenceOffers').doc(licenceRequest.currentOfferId).get()
    const existing = existingSnap.data()
    const existingExpiresAt = existing?.offerExpiresAt as Timestamp | null | undefined
    const existingExpired =
      existing?.status === 'pending' && existingExpiresAt != null && existingExpiresAt.toMillis() < Date.now()
    if (!existingExpired) {
      throw new HttpsError('failed-precondition', 'An offer already exists on this request — use counterOffer instead.')
    }
    // The old offer expired unaccepted — the artist can replace it with a fresh one instead of countering it.
    await existingSnap.ref.update({ status: 'expired' })
    reissueVersion = (existing!.version as number) + 1
  }
  await enforceTrackDealSettings(licenceRequest.trackId, terms.priceMinor, true, licenceRequest.status)

  const offerRef = db.collection('licenceOffers').doc()
  const conversationRef = licenceRequest.conversationId
    ? db.collection('conversations').doc(licenceRequest.conversationId)
    : null
  const batch = db.batch()

  batch.set(offerRef, buildOfferDoc(offerRef.id, requestId, licenceRequest, uid, 'artist', terms, reissueVersion, null))
  batch.update(requestRef, { status: 'offer_sent', currentOfferId: offerRef.id, updatedAt: FieldValue.serverTimestamp() })
  writeRequestEvent(batch, requestRef, {
    type: 'offer_sent', actorId: uid, actorRole: 'artist', summary: 'Artist sent revised terms.', offerId: offerRef.id,
  })
  if (conversationRef) writeSystemMessage(batch, conversationRef, uid, 'offer_card', 'Artist sent an offer.', { offerId: offerRef.id })
  batch.set(db.collection('notifications').doc(), {
    userId: licenceRequest.djId,
    type: 'offer_sent',
    title: 'New offer',
    body: 'The artist sent you a licence offer.',
    linkTo: '/dj/requests',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
  return { offerId: offerRef.id }
})

/** Either party can counter the other's currently pending offer. */
export const counterOffer = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const { requestId, ...terms } = request.data ?? {}
  validateTerms(terms)

  const { requestRef, licenceRequest, isArtist } = await loadNegotiableRequest(requestId, uid)
  if (!licenceRequest.currentOfferId) throw new HttpsError('failed-precondition', 'No offer to counter yet.')

  const previousRef = db.collection('licenceOffers').doc(licenceRequest.currentOfferId)
  const previousSnap = await previousRef.get()
  if (!previousSnap.exists) throw new HttpsError('not-found', 'Current offer not found.')
  const previous = previousSnap.data()!
  if (previous.status !== 'pending') throw new HttpsError('failed-precondition', 'This offer is no longer pending.')
  const previousExpiresAt = previous.offerExpiresAt as Timestamp | null | undefined
  if (previousExpiresAt != null && previousExpiresAt.toMillis() < Date.now()) {
    await previousRef.update({ status: 'expired' })
    throw new HttpsError('failed-precondition', 'This offer has expired and can no longer be countered.')
  }
  if (previous.createdBy === uid) throw new HttpsError('failed-precondition', 'You cannot counter your own offer.')
  await enforceTrackDealSettings(licenceRequest.trackId, terms.priceMinor, false, licenceRequest.status)

  const offerRef = db.collection('licenceOffers').doc()
  const conversationRef = licenceRequest.conversationId
    ? db.collection('conversations').doc(licenceRequest.conversationId)
    : null
  const batch = db.batch()

  batch.update(previousRef, { status: 'countered', supersededByOfferId: offerRef.id })
  batch.set(
    offerRef,
    buildOfferDoc(offerRef.id, requestId, licenceRequest, uid, isArtist ? 'artist' : 'dj', terms, previous.version + 1, null),
  )
  batch.update(requestRef, { status: 'counter_offer', currentOfferId: offerRef.id, updatedAt: FieldValue.serverTimestamp() })
  writeRequestEvent(batch, requestRef, {
    type: 'counter_offer', actorId: uid, actorRole: isArtist ? 'artist' : 'dj',
    summary: `${isArtist ? 'Artist' : 'DJ'} sent a counter-offer.`, offerId: offerRef.id,
  })
  if (conversationRef) {
    writeSystemMessage(batch, conversationRef, uid, 'offer_card', `${isArtist ? 'Artist' : 'DJ'} sent a counter-offer.`, {
      offerId: offerRef.id,
    })
  }
  const notifyId = isArtist ? licenceRequest.djId : licenceRequest.artistId
  const notifyLink = isArtist ? '/dj/requests' : '/dashboard/artist/dj-requests'
  batch.set(db.collection('notifications').doc(), {
    userId: notifyId,
    type: 'offer_sent',
    title: 'Counter-offer received',
    body: 'The other party sent a counter-offer.',
    linkTo: notifyLink,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
  return { offerId: offerRef.id }
})

/** Accepting the other party's pending offer freezes terms and generates the contract. */
export const acceptOffer = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const { requestId } = request.data ?? {}

  const { requestRef, licenceRequest, isArtist } = await loadNegotiableRequest(requestId, uid)
  if (!licenceRequest.currentOfferId) throw new HttpsError('failed-precondition', 'No offer to accept.')

  const offerRef = db.collection('licenceOffers').doc(licenceRequest.currentOfferId)
  const offerSnap = await offerRef.get()
  if (!offerSnap.exists) throw new HttpsError('not-found', 'Offer not found.')
  const offer = offerSnap.data()!
  if (offer.status !== 'pending') throw new HttpsError('failed-precondition', 'This offer is no longer pending.')
  if (offer.requestId !== requestId || offer.artistId !== licenceRequest.artistId || offer.djId !== licenceRequest.djId || offer.trackId !== licenceRequest.trackId) {
    throw new HttpsError('failed-precondition', 'Offer and request do not match.')
  }
  const acceptOfferExpiresAt = offer.offerExpiresAt as Timestamp | null | undefined
  if (acceptOfferExpiresAt != null && acceptOfferExpiresAt.toMillis() < Date.now()) {
    await offerRef.update({ status: 'expired' })
    throw new HttpsError('failed-precondition', 'This offer has expired and can no longer be accepted.')
  }
  if (offer.createdBy === uid) throw new HttpsError('failed-precondition', 'You cannot accept your own offer.')

  const trackSnap = await db.collection('tracks').doc(licenceRequest.trackId).get()
  const track = trackSnap.data()
  if (track && (track.takenDown === true || (track.restrictedCapabilities ?? []).includes('dj_licensing'))) {
    throw new HttpsError('failed-precondition', 'This track is under a copyright review — no new contract can be generated for it right now.')
  }

  const terms: AgreementTerms = {
    permittedUse: offer.permittedUse,
    territory: offer.territory,
    startDate: offer.startDate,
    expiryDate: offer.expiryDate,
    licenceFeeMinor: offer.priceMinor,
    currency: offer.currency,
    attributionRequirements: offer.attributionRequirements,
    recordingPermission: offer.recordingPermission,
    streamingPermission: offer.streamingPermission,
    promotionalMixPermission: offer.promotionalMixPermission,
    commercialUse: true,
    redistributionAllowed: offer.redistributionAllowed,
    resaleAllowed: offer.resaleAllowed,
    remixAllowed: offer.remixAllowed,
    additionalTerms: offer.additionalTerms,
    rightsHolderDeclaration: true,
  }

  const conversationRef = licenceRequest.conversationId
    ? db.collection('conversations').doc(licenceRequest.conversationId)
    : null
  const batch = db.batch()
  batch.update(offerRef, { status: 'accepted' })
  const { agreementRef } = await writeAgreementVersion(batch, requestRef, licenceRequest, terms, { acceptedOfferId: offerRef.id })
  writeRequestEvent(batch, requestRef, {
    type: 'offer_accepted', actorId: uid, actorRole: isArtist ? 'artist' : 'dj',
    summary: `${isArtist ? 'Artist' : 'DJ'} accepted offer v${offer.version}. Contract generated.`,
    offerId: offerRef.id, agreementId: agreementRef.id,
  })

  if (conversationRef) {
    writeSystemMessage(batch, conversationRef, uid, 'offer_card', 'Offer accepted.', { offerId: offerRef.id })
    writeSystemMessage(batch, conversationRef, uid, 'contract_status', 'Contract generated — both parties can now sign.', {
      agreementId: agreementRef.id,
    })
  }
  const notifyId = isArtist ? licenceRequest.djId : licenceRequest.artistId
  batch.set(db.collection('notifications').doc(), {
    userId: notifyId,
    type: 'agreement_ready',
    title: 'Offer accepted',
    body: 'Your offer was accepted — the contract is ready to sign.',
    linkTo: `/agreements/${agreementRef.id}`,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
  return { agreementId: agreementRef.id }
})

/** Receiving party rejects the latest pending offer; history remains preserved and no contract is created. */
export const rejectOffer = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const { requestId, reason } = request.data ?? {}
  const { requestRef, licenceRequest, isArtist } = await loadNegotiableRequest(requestId, uid)
  if (!licenceRequest.currentOfferId) throw new HttpsError('failed-precondition', 'No offer to reject.')
  const offerRef = db.collection('licenceOffers').doc(licenceRequest.currentOfferId)
  const offerSnap = await offerRef.get()
  if (!offerSnap.exists) throw new HttpsError('not-found', 'Offer not found.')
  const offer = offerSnap.data()!
  if (offer.status !== 'pending') throw new HttpsError('failed-precondition', 'This offer is no longer pending.')
  if (offer.createdBy === uid) throw new HttpsError('failed-precondition', 'You cannot reject your own offer.')
  const expiresAt = offer.offerExpiresAt as Timestamp | null | undefined
  if (expiresAt && expiresAt.toMillis() < Date.now()) throw new HttpsError('failed-precondition', 'This offer has expired.')

  const batch = db.batch()
  batch.update(offerRef, {
    status: 'rejected',
    rejectedAt: FieldValue.serverTimestamp(),
    rejectionReason: typeof reason === 'string' ? reason.slice(0, 500) : null,
  })
  batch.update(requestRef, { status: 'rejected', updatedAt: FieldValue.serverTimestamp() })
  writeRequestEvent(batch, requestRef, {
    type: 'offer_rejected', actorId: uid, actorRole: isArtist ? 'artist' : 'dj',
    summary: `${isArtist ? 'Artist' : 'DJ'} rejected offer v${offer.version}.`, offerId: offerRef.id,
  })
  batch.set(db.collection('notifications').doc(), {
    userId: isArtist ? licenceRequest.djId : licenceRequest.artistId,
    type: 'offer_rejected', title: 'Offer rejected', body: 'The latest DJ licence offer was rejected.',
    linkTo: `/dj-requests/${requestId}`, read: false, createdAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()
  return { ok: true }
})

/** The offer's own creator can withdraw it while still pending. */
export const withdrawOffer = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const { requestId } = request.data ?? {}

  const { requestRef, licenceRequest } = await loadNegotiableRequest(requestId, uid)
  if (!licenceRequest.currentOfferId) throw new HttpsError('failed-precondition', 'No offer to withdraw.')

  const offerRef = db.collection('licenceOffers').doc(licenceRequest.currentOfferId)
  const offerSnap = await offerRef.get()
  if (!offerSnap.exists) throw new HttpsError('not-found', 'Offer not found.')
  const offer = offerSnap.data()!
  if (offer.status !== 'pending') throw new HttpsError('failed-precondition', 'This offer is no longer pending.')
  if (offer.createdBy !== uid) throw new HttpsError('permission-denied', 'You can only withdraw your own offer.')

  const conversationRef = licenceRequest.conversationId
    ? db.collection('conversations').doc(licenceRequest.conversationId)
    : null
  const batch = db.batch()
  batch.update(offerRef, { status: 'withdrawn' })
  batch.update(requestRef, { status: 'negotiating', currentOfferId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
  writeRequestEvent(batch, requestRef, {
    type: 'offer_withdrawn', actorId: uid, actorRole: offer.createdByRole,
    summary: `${offer.createdByRole === 'artist' ? 'Artist' : 'DJ'} withdrew the offer.`, offerId: offerRef.id,
  })
  if (conversationRef) writeSystemMessage(batch, conversationRef, uid, 'system', 'The offer was withdrawn.', { offerId: offerRef.id })

  await batch.commit()
  return { ok: true }
})

function buildOfferDoc(
  offerId: string,
  requestId: string,
  licenceRequest: DocumentData,
  createdBy: string,
  createdByRole: 'artist' | 'dj',
  terms: OfferTermsInput,
  version: number,
  supersededByOfferId: string | null,
) {
  return {
    offerId,
    requestId,
    trackId: licenceRequest.trackId,
    artistId: licenceRequest.artistId,
    djId: licenceRequest.djId,
    priceMinor: terms.priceMinor,
    currency: terms.currency,
    permittedUse: terms.permittedUse,
    territory: terms.territory,
    startDate: terms.startDate,
    expiryDate: terms.expiryDate,
    recordingPermission: terms.recordingPermission,
    streamingPermission: terms.streamingPermission,
    promotionalMixPermission: terms.promotionalMixPermission,
    attributionRequirements: terms.attributionRequirements,
    redistributionAllowed: terms.redistributionAllowed,
    resaleAllowed: terms.resaleAllowed,
    remixAllowed: terms.remixAllowed,
    additionalTerms: terms.additionalTerms,
    offerExpiresAt: terms.offerExpiresAt ? Timestamp.fromDate(new Date(`${terms.offerExpiresAt}T23:59:59.999Z`)) : null,
    createdBy,
    createdByRole,
    createdAt: FieldValue.serverTimestamp(),
    status: 'pending',
    version,
    supersededByOfferId,
  }
}
