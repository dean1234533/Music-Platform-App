import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import { getStripe, stripeSecretKey } from './client.js'
import { getPlatformSettings } from '../platformSettings.js'
import { resolveLicencePartyRole } from '../licensing/party.js'

export const createLicencePaymentSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const { agreementId, successUrl, cancelUrl, actingRole: requestedRole } = request.data ?? {}
  if (!agreementId || !successUrl || !cancelUrl) {
    throw new HttpsError('invalid-argument', 'agreementId, successUrl, and cancelUrl are required.')
  }

  const agreementRef = db.collection('licenceAgreements').doc(agreementId)
  const snap = await agreementRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Agreement not found.')
  const agreement = snap.data()!

  if (resolveLicencePartyRole(agreement, request.auth.uid, requestedRole) !== 'dj') {
    throw new HttpsError('permission-denied', 'Only the requesting DJ can pay for this licence.')
  }
  if (agreement.status !== 'awaiting_payment') {
    throw new HttpsError('failed-precondition', 'Both parties must sign before payment.')
  }
  if (agreement.paidAt) {
    throw new HttpsError('failed-precondition', 'This licence has already been paid.')
  }
  if (!agreement.licenceFeeMinor || agreement.licenceFeeMinor <= 0) {
    throw new HttpsError('failed-precondition', 'This licence does not require payment.')
  }

  const trackSnap = await db.collection('tracks').doc(agreement.trackId).get()
  const track = trackSnap.data()
  if (track && (track.takenDown === true || (track.restrictedCapabilities ?? []).includes('dj_licensing'))) {
    throw new HttpsError('failed-precondition', 'This track is under a copyright review — payment is temporarily unavailable.')
  }
  const trackTitle = track?.title ?? 'Track licence'

  let session
  try {
    const settings = await getPlatformSettings()
    const platformFeeMinor = Math.round(agreement.licenceFeeMinor * (settings.djServiceFeePercent / 100))
    const artistNetMinor = agreement.licenceFeeMinor - platformFeeMinor

    await agreementRef.update({
      platformFeePercent: settings.djServiceFeePercent,
      platformFeeMinor,
      artistNetMinor,
    })

    const stripe = getStripe()
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: agreement.currency ?? 'gbp',
            unit_amount: Math.round(agreement.licenceFeeMinor),
            product_data: { name: `DJ licence: ${trackTitle}` },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { agreementId, kind: 'licence_payment' },
    })
  } catch (error) {
    // Any uncaught error here (a raw Stripe SDK rejection, an unexpected Firestore write
    // failure) was previously left uncaught — firebase-functions wraps that as an opaque
    // INTERNAL/500 with no detail on either side. This environment's log tooling can't
    // reliably surface recent invocation logs, so the real cause is included directly in the
    // message returned to the client instead of only being logged server-side — visible as
    // error.message on whatever caught the callable's rejection (e.g. ContractPage's
    // handlePay's actionError).
    console.error('[createLicencePaymentSession] failed:', error)
    const detail = error instanceof Error ? error.message : String(error)
    throw new HttpsError('internal', `Could not start payment: ${detail}`)
  }

  return { url: session.url }
})
