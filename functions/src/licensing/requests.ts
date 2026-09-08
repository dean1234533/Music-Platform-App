import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireActiveUser, userHasRole } from '../roles.js'
import { writeSystemMessage } from '../messaging/messages.js'
import { enforceRateLimit } from '../rateLimit.js'

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
 * both the licenceRequest (source of truth for status) and a conversation
 * scoped to it, so messaging never floats free of a specific request.
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
  if (!track.djPromotion || track.djLicenceMode === 'not_available') {
    throw new HttpsError('failed-precondition', 'This track is not open for DJ requests.')
  }
  const dealSettings = track.djDealSettings as
    | { acceptDjRequests: boolean; allowedDealIds: string[]; verifiedDjsOnly: boolean }
    | undefined
  if (dealSettings && !dealSettings.acceptDjRequests) {
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
  const artistSnap = await db.collection('artistProfiles').doc(artistId).get()
  const policy = (artistSnap.data()?.djAllowRequests as string) ?? 'disabled'
  if (policy === 'disabled') {
    throw new HttpsError('failed-precondition', 'This artist is not accepting DJ requests right now.')
  }

  const djProfileRef = db.collection('djProfiles').doc(djId)
  const djUserSnap = await db.collection('users').doc(djId).get()
  const djName = (djUserSnap.data()?.displayName as string) || 'A DJ'
  const requestRef = db.collection('licenceRequests').doc()
  const conversationRef = db.collection('conversations').doc()

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
      conversationId: conversationRef.id,
      legalHold: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.set(conversationRef, {
      conversationId: conversationRef.id,
      participantIds: [djId, artistId],
      trackId,
      licenceRequestId: requestRef.id,
      lastMessageAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    })
    writeSystemMessage(tx, conversationRef, djId, 'system', `${djName} requested access to "${track.title}".`)
    tx.set(db.collection('notifications').doc(), {
      userId: artistId,
      type: 'dj_request',
      title: 'New DJ request',
      body: `A DJ requested access to "${track.title}".`,
      linkTo: `/dashboard/artist/dj-requests`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
  })

  return { requestId: requestRef.id, conversationId: conversationRef.id }
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

  await ref.update({ status: nextStatus, updatedAt: FieldValue.serverTimestamp() })

  const notifyUserId = isArtist ? data.djId : data.artistId
  await db.collection('notifications').add({
    userId: notifyUserId,
    type: nextStatus === 'rejected' ? 'request_rejected' : 'new_message',
    title: nextStatus === 'rejected' ? 'Request declined' : 'Request update',
    body: `Your DJ request status changed to "${nextStatus}".`,
    linkTo: '/dj/requests',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  return { status: nextStatus }
})
