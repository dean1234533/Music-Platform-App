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
  const settings = await getPlatformSettings()
  const platformFeeMinor = Math.round(agreement.licenceFeeMinor * (settings.djServiceFeePercent / 100))
  const artistNetMinor = agreement.licenceFeeMinor - platformFeeMinor

  await agreementRef.update({
    platformFeePercent: settings.djServiceFeePercent,
    platformFeeMinor,
    artistNetMinor,
  })

  const stripe = getStripe()
  let session
  try {
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
    // A raw Stripe SDK error (bad currency, non-integer amount, API outage) was previously
    // left uncaught — firebase-functions wraps that as an opaque 500 with no detail on either
    // side, and the platform-fee fields above had already been written even though the
    // session never got created. Surface a clear, retryable error instead.
    console.error('[createLicencePaymentSession] Stripe session creation failed:', error)
    throw new HttpsError('internal', 'Could not start payment. Please try again in a moment.')
  }

  return { url: session.url }
})
