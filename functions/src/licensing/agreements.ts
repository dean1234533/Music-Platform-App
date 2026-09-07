import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

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
 * Only the artist proposes terms. Once either party has accepted a version,
 * a change creates a brand new agreement doc (agreementVersion + 1) rather
 * than mutating signed terms — signed agreements are immutable per the spec.
 */
export const proposeAgreement = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
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

  let version = 1
  let previousRef: FirebaseFirestore.DocumentReference | null = null

  if (licenceRequest.currentAgreementId) {
    previousRef = db.collection('licenceAgreements').doc(licenceRequest.currentAgreementId)
    const previousSnap = await previousRef.get()
    if (previousSnap.exists) {
      const previous = previousSnap.data()!
      if (!previous.artistAcceptedAt && !previous.djAcceptedAt) {
        // Nobody has accepted yet — safe to edit this version in place.
        await previousRef.update({
          permittedUse: input.permittedUse,
          territory: input.territory,
          startDate: input.startDate,
          expiryDate: input.expiryDate,
          licenceFeeMinor: input.licenceFeeMinor,
          currency: input.currency,
          attributionRequirements: input.attributionRequirements,
          recordingPermission: input.recordingPermission,
          streamingPermission: input.streamingPermission,
          commercialUse: input.commercialUse,
          redistributionAllowed: input.redistributionAllowed,
          resaleAllowed: input.resaleAllowed,
          additionalTerms: input.additionalTerms,
          updatedAt: FieldValue.serverTimestamp(),
        })
        await requestRef.update({ status: 'agreement_ready', updatedAt: FieldValue.serverTimestamp() })
        return { agreementId: previousRef.id, agreementVersion: previous.agreementVersion }
      }
      version = previous.agreementVersion + 1
    }
  }

  const agreementRef = db.collection('licenceAgreements').doc()
  const batch = db.batch()

  if (previousRef) {
    batch.update(previousRef, { status: 'superseded', updatedAt: FieldValue.serverTimestamp() })
  }

  batch.set(agreementRef, {
    agreementId: agreementRef.id,
    licenceRequestId: input.requestId,
    artistId: licenceRequest.artistId,
    djId: licenceRequest.djId,
    trackId: licenceRequest.trackId,
    trackVersion: 1,
    permittedUse: input.permittedUse,
    territory: input.territory,
    startDate: input.startDate,
    expiryDate: input.expiryDate,
    licenceFeeMinor: input.licenceFeeMinor,
    currency: input.currency,
    attributionRequirements: input.attributionRequirements,
    recordingPermission: input.recordingPermission,
    streamingPermission: input.streamingPermission,
    commercialUse: input.commercialUse,
    redistributionAllowed: input.redistributionAllowed,
    resaleAllowed: input.resaleAllowed,
    additionalTerms: input.additionalTerms,
    agreementVersion: version,
    status: 'pending',
    artistAcceptedAt: null,
    djAcceptedAt: null,
    paidAt: null,
    downloadRevoked: false,
    downloadCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    finalisedAt: null,
  })

  batch.update(requestRef, {
    status: 'agreement_ready',
    currentAgreementId: agreementRef.id,
    updatedAt: FieldValue.serverTimestamp(),
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
  const uid = request.auth.uid
  const { agreementId, agreedToTerms } = request.data ?? {}
  if (!agreementId || typeof agreementId !== 'string') throw new HttpsError('invalid-argument', 'agreementId is required.')
  if (agreedToTerms !== true) throw new HttpsError('invalid-argument', 'You must confirm you agree to the terms.')

  const agreementRef = db.collection('licenceAgreements').doc(agreementId)
  const snap = await agreementRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Agreement not found.')
  const agreement = snap.data()!

  if (agreement.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This agreement is no longer awaiting signatures.')
  }

  const isArtist = agreement.artistId === uid
  const isDj = agreement.djId === uid
  if (!isArtist && !isDj) throw new HttpsError('permission-denied', 'Not a party to this agreement.')
  if (isArtist && agreement.artistAcceptedAt) throw new HttpsError('failed-precondition', 'Already signed.')
  if (isDj && agreement.djAcceptedAt) throw new HttpsError('failed-precondition', 'Already signed.')

  const now = FieldValue.serverTimestamp()
  const acceptanceLogRef = db.collection('licenceAgreementAcceptances').doc()

  const update: Record<string, unknown> = { updatedAt: now }
  if (isArtist) update.artistAcceptedAt = now
  if (isDj) update.djAcceptedAt = now

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
    agreementVersion: agreement.agreementVersion,
    acceptedAt: now,
  })

  if (bothWillBeAccepted) {
    batch.update(agreementRef, { status: 'signed', finalisedAt: now })
    const requestRef = db.collection('licenceRequests').doc(agreement.licenceRequestId)
    const requiresPayment = (agreement.licenceFeeMinor ?? 0) > 0
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
      linkTo: '/dj/requests',
      read: false,
      createdAt: now,
    })
  }

  await batch.commit()
  return { ok: true, bothAccepted: bothWillBeAccepted }
})
