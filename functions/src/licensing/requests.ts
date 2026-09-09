import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireActiveUser, userHasRole } from '../roles.js'
import { enforceRateLimit } from '../rateLimit.js'
import { writeAgreementVersion, type AgreementTerms } from './agreements.js'
import { writeRequestEvent } from './events.js'

const INTENDED_USES = [
  'live_club_performance',
  'festival_performance',
  'radio_show',
  'dj_set',
  'promotional_mix',
  'online_stream',
  'other',
] as const

/**
 * Kicks off the DJ loop: DJ requests access to a DJ-promoted track. Creates
 * the licenceRequest (source of truth for status). Every request waits for an
 * explicit artist decision. A published deal is snapshotted onto the request
 * so later edits to that reusable template cannot silently change this deal.
 */
export const submitLicenceRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const djId = request.auth.uid
  if (!(await userHasRole(djId, 'dj'))) {
    throw new HttpsError('permission-denied', 'A DJ profile is required to request tracks.')
  }
  await enforceRateLimit(`submitLicenceRequest_${djId}`, 20, 60 * 60)

  const {
    trackId,
    intendedUse,
    territory,
    expectedDate,
    venue,
    message,
    dealId,
    requestedStartDate,
    requestedEndDate,
    recordingIntention,
    streamingIntention,
  } = request.data ?? {}
  if (!trackId || typeof trackId !== 'string') throw new HttpsError('invalid-argument', 'trackId is required.')
  if (!INTENDED_USES.includes(intendedUse)) throw new HttpsError('invalid-argument', 'Invalid intendedUse.')

  const trackSnap = await db.collection('tracks').doc(trackId).get()
  if (!trackSnap.exists) throw new HttpsError('not-found', 'Track not found.')
  const track = trackSnap.data()!
  if (track.takenDown === true || (track.restrictedCapabilities ?? []).includes('dj_licensing')) {
    throw new HttpsError('failed-precondition', 'This track is under a copyright review and is not available for new DJ requests.')
  }
  const dealSettings = track.djDealSettings as
    | { acceptDjRequests: boolean; allowedDealIds: string[]; verifiedDjsOnly: boolean }
    | undefined
  const acceptsDjRequests = dealSettings
    ? dealSettings.acceptDjRequests
    : Boolean(track.djPromotion && track.djLicenceMode !== 'not_available')
  if (!acceptsDjRequests) {
    throw new HttpsError('failed-precondition', 'This track is not open for DJ requests.')
  }
  if (dealId && (!dealSettings || !dealSettings.allowedDealIds.includes(dealId))) {
    throw new HttpsError('invalid-argument', 'That deal is not available on this track.')
  }
  const embargoUntil = track.embargoUntil as Timestamp | null
  if (embargoUntil && embargoUntil.toMillis() > Date.now()) {
    throw new HttpsError('failed-precondition', 'This release is under embargo and not yet available for requests.')
  }
  const artistId = track.artistId as string
  const [artistSnap, blockedByArtist, blockedByDj] = await Promise.all([
    db.collection('artistProfiles').doc(artistId).get(),
    db.collection('blockedUsers').doc(`${artistId}_${djId}`).get(),
    db.collection('blockedUsers').doc(`${djId}_${artistId}`).get(),
  ])
  if (blockedByArtist.exists || blockedByDj.exists) {
    throw new HttpsError('permission-denied', 'You can’t request tracks from this artist.')
  }
  const policy = (artistSnap.data()?.djAllowRequests as string) ?? 'disabled'
  if (policy === 'disabled') {
    throw new HttpsError('failed-precondition', 'This artist is not accepting DJ requests right now.')
  }

  const djProfileRef = db.collection('djProfiles').doc(djId)
  const djUserSnap = await db.collection('users').doc(djId).get()
  const djName = (djUserSnap.data()?.displayName as string) || 'A DJ'
  const requestRef = db.collection('licenceRequests').doc()
  let deal: FirebaseFirestore.DocumentData | null = null
  if (dealId) {
    const dealSnap = await db.collection('djDeals').doc(dealId).get()
    if (!dealSnap.exists) throw new HttpsError('not-found', 'Deal not found.')
    deal = dealSnap.data()!
    if (!deal.active || deal.artistId !== artistId) {
      throw new HttpsError('failed-precondition', 'This deal is no longer available.')
    }
  }

  await db.runTransaction(async (tx) => {
    const djSnap = await tx.get(djProfileRef)
    const djData = djSnap.data() ?? {}

    const requireVerified = policy === 'verified_only' || policy === 'approved_only' || dealSettings?.verifiedDjsOnly
    if (requireVerified) {
      // NOTE: artist-level 'approved_only' currently enforces the same bar as
      // 'verified_only' (a verified DJ badge). A per-artist DJ allowlist is a
      // follow-up beyond this MVP — artists can still reject individual
      // requests manually.
      if (djData.verificationStatus !== 'verified') {
        throw new HttpsError('permission-denied', 'This artist only accepts requests from verified DJs.')
      }
    }

    tx.set(requestRef, {
      requestId: requestRef.id,
      djId,
      artistId,
      trackId,
      trackGenre: track.genre ?? '',
      intendedUse,
      territory: territory ?? null,
      expectedDate: expectedDate ?? null,
      venue: venue ?? null,
      message: message ?? '',
      dealId: dealId ?? null,
      requestedStartDate: requestedStartDate ?? null,
      requestedEndDate: requestedEndDate ?? null,
      recordingIntention: Boolean(recordingIntention),
      streamingIntention: Boolean(streamingIntention),
      status: 'submitted',
      currentAgreementId: null,
      trackTitleSnapshot: track.title ?? 'Track',
      artistNameSnapshot: (artistSnap.data()?.name as string) || 'Artist',
      djNameSnapshot: djName,
      selectedDealSnapshot: deal
        ? {
            dealId,
            name: deal.name ?? 'DJ deal',
            description: deal.description ?? '',
            priceType: deal.priceType,
            priceMinor: deal.priceMinor ?? 0,
            currency: deal.currency ?? 'gbp',
            permittedUse: deal.permittedUse ?? '',
            territory: deal.territory ?? '',
            durationDays: deal.durationDays ?? null,
            recordingPermission: Boolean(deal.recordingPermission),
            streamingPermission: Boolean(deal.streamingPermission),
            promotionalMixPermission: Boolean(deal.promotionalMixPermission),
            remixPermission: Boolean(deal.remixAllowed),
            redistributionPermission: Boolean(deal.redistributionAllowed),
            resalePermission: Boolean(deal.resaleAllowed),
            attributionRequirements: deal.attributionRequirements ?? '',
            additionalTerms: deal.additionalTerms ?? '',
          }
        : null,
      legalHold: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    writeRequestEvent(tx, requestRef, {
      type: 'request_submitted',
      actorId: djId,
      actorRole: 'dj',
      summary: deal ? `${djName} requested “${deal.name ?? 'DJ deal'}”.` : `${djName} requested custom terms.`,
    })
    tx.set(db.collection('notifications').doc(), {
      userId: artistId,
      type: 'dj_request',
      title: 'New DJ request',
      body: `${djName} requested access to "${track.title}". Review the selected deal or send revised terms.`,
      linkTo: `/dj-requests/${requestRef.id}`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
  })

  return { requestId: requestRef.id, agreementId: null }
})

/** Artist accepts the exact reusable deal snapshot the DJ selected. */
export const acceptExistingDeal = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const { requestId } = request.data ?? {}
  if (!requestId || typeof requestId !== 'string') throw new HttpsError('invalid-argument', 'requestId is required.')

  const requestRef = db.collection('licenceRequests').doc(requestId)
  const requestSnap = await requestRef.get()
  if (!requestSnap.exists) throw new HttpsError('not-found', 'Request not found.')
  const licenceRequest = requestSnap.data()!
  if (licenceRequest.artistId !== request.auth.uid) throw new HttpsError('permission-denied', 'Only the artist can accept this deal.')
  if (!['submitted', 'artist_review'].includes(licenceRequest.status)) {
    throw new HttpsError('failed-precondition', 'This request is no longer awaiting artist review.')
  }
  const deal = licenceRequest.selectedDealSnapshot
  if (!deal || !['free', 'fixed'].includes(deal.priceType)) {
    throw new HttpsError('failed-precondition', 'This request needs a structured final offer instead.')
  }
  const trackSnap = await db.collection('tracks').doc(licenceRequest.trackId).get()
  const track = trackSnap.data()
  if (!track || track.takenDown === true || (track.restrictedCapabilities ?? []).includes('dj_licensing')) {
    throw new HttpsError('failed-precondition', 'This track is not available for a new contract.')
  }
  const startDate = licenceRequest.requestedStartDate || new Date().toISOString().slice(0, 10)
  const expiryDate = deal.durationDays
    ? new Date(new Date(`${startDate}T00:00:00.000Z`).getTime() + deal.durationDays * 86_400_000).toISOString().slice(0, 10)
    : licenceRequest.requestedEndDate || null
  const terms: AgreementTerms = {
    permittedUse: deal.permittedUse,
    territory: deal.territory,
    startDate,
    expiryDate,
    licenceFeeMinor: deal.priceType === 'fixed' ? deal.priceMinor ?? 0 : 0,
    currency: deal.currency ?? 'gbp',
    attributionRequirements: deal.attributionRequirements ?? '',
    recordingPermission: Boolean(deal.recordingPermission),
    streamingPermission: Boolean(deal.streamingPermission),
    promotionalMixPermission: Boolean(deal.promotionalMixPermission),
    commercialUse: true,
    redistributionAllowed: Boolean(deal.redistributionPermission),
    resaleAllowed: Boolean(deal.resalePermission),
    remixAllowed: Boolean(deal.remixPermission),
    additionalTerms: deal.additionalTerms ?? '',
    rightsHolderDeclaration: true,
  }
  const batch = db.batch()
  const { agreementRef } = await writeAgreementVersion(batch, requestRef, licenceRequest, terms, { sourceDealId: deal.dealId ?? null })
  writeRequestEvent(batch, requestRef, {
    type: 'deal_accepted', actorId: request.auth.uid, actorRole: 'artist',
    summary: `Artist accepted “${deal.name}”. Contract generated.`, agreementId: agreementRef.id,
  })
  batch.set(db.collection('notifications').doc(), {
    userId: licenceRequest.djId,
    type: 'agreement_ready', title: 'Deal accepted — contract ready',
    body: 'The artist accepted the selected deal. Review and sign the locked contract.',
    linkTo: `/agreements/${agreementRef.id}`, read: false, createdAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()
  return { agreementId: agreementRef.id }
})

const ARTIST_ACTIONS = ['start_negotiation', 'reject'] as const
const DJ_ACTIONS = ['cancel'] as const

export const respondToLicenceRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const { requestId, action } = request.data ?? {}
  if (!requestId || typeof requestId !== 'string') throw new HttpsError('invalid-argument', 'requestId is required.')

  const ref = db.collection('licenceRequests').doc(requestId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Request not found.')
  const data = snap.data()!

  const isArtist = data.artistId === uid
  const isDj = data.djId === uid
  if (!isArtist && !isDj) throw new HttpsError('permission-denied', 'Not a participant in this request.')

  let nextStatus: string
  if (isArtist && (ARTIST_ACTIONS as readonly string[]).includes(action)) {
    nextStatus = action === 'start_negotiation' ? 'negotiating' : 'rejected'
  } else if (isDj && (DJ_ACTIONS as readonly string[]).includes(action)) {
    nextStatus = 'cancelled'
  } else {
    throw new HttpsError('permission-denied', 'You cannot perform this action on this request.')
  }

  if (['approved', 'rejected', 'cancelled', 'expired'].includes(data.status)) {
    throw new HttpsError('failed-precondition', 'This request is already finalised.')
  }

  const notifyUserId = isArtist ? data.djId : data.artistId
  const batch = db.batch()
  batch.update(ref, { status: nextStatus, updatedAt: FieldValue.serverTimestamp() })
  writeRequestEvent(batch, ref, {
    type: nextStatus,
    actorId: uid,
    actorRole: isArtist ? 'artist' : 'dj',
    summary: nextStatus === 'rejected' ? 'Artist rejected the request.' : 'DJ cancelled the request.',
  })
  batch.set(db.collection('notifications').doc(), {
    userId: notifyUserId,
    type: nextStatus === 'rejected' ? 'request_rejected' : 'request_cancelled',
    title: nextStatus === 'rejected' ? 'Request declined' : 'Request cancelled',
    body: `Your DJ request status changed to "${nextStatus}".`,
    linkTo: `/dj-requests/${requestId}`,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()

  return { status: nextStatus }
})
