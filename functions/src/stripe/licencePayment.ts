import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from '../admin.js'
import { getStripe, stripeSecretKey } from './client.js'
import { getPlatformSettings } from '../platformSettings.js'

export const createLicencePaymentSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const { agreementId, successUrl, cancelUrl } = request.data ?? {}
  if (!agreementId || !successUrl || !cancelUrl) {
    throw new HttpsError('invalid-argument', 'agreementId, successUrl, and cancelUrl are required.')
  }

  const agreementRef = db.collection('licenceAgreements').doc(agreementId)
  const snap = await agreementRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Agreement not found.')
  const agreement = snap.data()!

  if (agreement.djId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only the requesting DJ can pay for this licence.')
  }
  if (agreement.status !== 'signed') {
    throw new HttpsError('failed-precondition', 'Both parties must sign before payment.')
  }
  if (agreement.paidAt) {
    throw new HttpsError('failed-precondition', 'This licence has already been paid.')
  }
  if (!agreement.licenceFeeMinor || agreement.licenceFeeMinor <= 0) {
    throw new HttpsError('failed-precondition', 'This licence does not require payment.')
  }

  const trackSnap = await db.collection('tracks').doc(agreement.trackId).get()
  const trackTitle = trackSnap.data()?.title ?? 'Track licence'
  const settings = await getPlatformSettings()
  const platformFeeMinor = Math.round(agreement.licenceFeeMinor * (settings.djServiceFeePercent / 100))
  const artistNetMinor = agreement.licenceFeeMinor - platformFeeMinor

  await agreementRef.update({
    platformFeePercent: settings.djServiceFeePercent,
    platformFeeMinor,
    artistNetMinor,
  })

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: agreement.currency ?? 'gbp',
          unit_amount: agreement.licenceFeeMinor,
          product_data: { name: `DJ licence: ${trackTitle}` },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { agreementId, kind: 'licence_payment' },
  })

  return { url: session.url }
})
