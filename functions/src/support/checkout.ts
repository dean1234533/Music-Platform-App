import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import { enforceRateLimit } from '../rateLimit.js'
import { getPlatformSettings } from '../platformSettings.js'
import { getStripe, stripeSecretKey } from '../stripe/client.js'

/** Smallest/largest one-off support amount we'll create a Checkout Session for — a sanity bound, not a business decision. */
const MIN_SUPPORT_MINOR = 100
const MAX_SUPPORT_MINOR = 100_000

/**
 * Creates a Stripe Checkout Session for a one-off support payment to a single
 * artist. This is the entire "fan financially supports an artist" flow —
 * there is no subscription, no monthly allocation, and no internal balance.
 * Stripe Connect's destination-charge mechanism (`payment_intent_data`) pays
 * the artist's connected account directly at the moment of charge; BackTheVibes
 * only ever receives its configured `application_fee_amount` cut. The exact
 * percentage always comes from platformSettings — never trusted from the client,
 * never hard-coded here.
 */
export const createSupportCheckoutSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const fanId = request.auth.uid
  await enforceRateLimit(`createSupportCheckoutSession_${fanId}`, 20, 3600)

  const artistId = request.data?.artistId as string | undefined
  const amountMinor = request.data?.amountMinor as number | undefined
  const successUrl = request.data?.successUrl as string | undefined
  const cancelUrl = request.data?.cancelUrl as string | undefined
  if (!artistId || !successUrl || !cancelUrl) {
    throw new HttpsError('invalid-argument', 'artistId, successUrl, and cancelUrl are required.')
  }
  if (
    typeof amountMinor !== 'number' ||
    !Number.isInteger(amountMinor) ||
    amountMinor < MIN_SUPPORT_MINOR ||
    amountMinor > MAX_SUPPORT_MINOR
  ) {
    throw new HttpsError('invalid-argument', `amountMinor must be an integer between ${MIN_SUPPORT_MINOR} and ${MAX_SUPPORT_MINOR}.`)
  }
  if (artistId === fanId) throw new HttpsError('invalid-argument', 'You cannot support your own artist profile.')

  const [artistProfileSnap, payoutAccountSnap, holdSnap] = await Promise.all([
    db.collection('artistProfiles').doc(artistId).get(),
    db.collection('artistPayoutAccounts').doc(artistId).get(),
    db.collection('payoutHolds').doc(artistId).get(),
  ])
  if (!artistProfileSnap.exists) throw new HttpsError('not-found', 'Artist not found.')
  if (holdSnap.exists && holdSnap.data()?.active) {
    throw new HttpsError('failed-precondition', 'This artist cannot currently receive payments (under review).')
  }
  const payoutAccount = payoutAccountSnap.data()
  const stripeAccountId = payoutAccount?.stripeAccountId as string | undefined
  if (!stripeAccountId || !payoutAccount?.chargesEnabled) {
    throw new HttpsError('failed-precondition', 'This artist has not finished connecting Stripe yet.')
  }

  const settings = await getPlatformSettings()
  const platformFeeMinor = Math.round(amountMinor * (settings.platformFeePercent / 100))
  const artistNetMinor = amountMinor - platformFeeMinor
  const artistName = (artistProfileSnap.data()?.name as string | undefined) ?? 'this artist'

  const userSnap = await db.collection('users').doc(fanId).get()
  let customerId = userSnap.data()?.stripeCustomerId as string | undefined
  const stripe = getStripe()
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userSnap.data()?.email ?? undefined,
      metadata: { firebaseUid: fanId },
    })
    customerId = customer.id
    await db.collection('users').doc(fanId).update({ stripeCustomerId: customerId })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          unit_amount: amountMinor,
          product_data: { name: `Support ${artistName} on BackTheVibes` },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: platformFeeMinor,
      transfer_data: { destination: stripeAccountId },
      metadata: { kind: 'artist_support', artistId, fanId },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { kind: 'artist_support', artistId, fanId, platformFeeMinor: String(platformFeeMinor), artistNetMinor: String(artistNetMinor) },
  })

  return { url: session.url }
})
