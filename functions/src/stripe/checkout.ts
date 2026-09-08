import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import type { PlanDoc } from '../entitlements.js'
import { getStripe, stripeSecretKey } from './client.js'

/**
 * Creates a Stripe Checkout Session for a subscription plan. The client only
 * ever receives back a redirect URL — no Stripe secret key, no price/amount
 * trust decisions happen here beyond looking up the plan the admin actually
 * configured for the requested role.
 */
export const createCheckoutSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const uid = request.auth.uid
  const planId = request.data?.planId as string | undefined
  const role = request.data?.role as string | undefined
  const successUrl = request.data?.successUrl as string | undefined
  const cancelUrl = request.data?.cancelUrl as string | undefined
  if (!planId || !role || !successUrl || !cancelUrl) {
    throw new HttpsError('invalid-argument', 'planId, role, successUrl, and cancelUrl are required.')
  }
  if (role !== 'fan' && role !== 'artist') throw new HttpsError('invalid-argument', 'Unsupported subscription role.')

  const planSnap = await db.collection('subscriptionPlans').doc(planId).get()
  if (!planSnap.exists) throw new HttpsError('not-found', 'Subscription plan not found.')
  const plan = planSnap.data() as PlanDoc
  if (!plan.active) throw new HttpsError('failed-precondition', 'This plan is no longer available.')
  if (plan.role !== role) throw new HttpsError('invalid-argument', 'Plan does not match the requested role.')
  if (!plan.stripePriceId) throw new HttpsError('failed-precondition', 'This plan has no billing configured yet.')

  const stripe = getStripe()
  const userRef = db.collection('users').doc(uid)
  const userSnap = await userRef.get()
  const userData = userSnap.data() ?? {}

  let customerId = userData.stripeCustomerId as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.email ?? undefined,
      metadata: { firebaseUid: uid },
    })
    customerId = customer.id
    await userRef.update({ stripeCustomerId: customerId })
  }

  // Artist Membership gets a one-time 14-day free trial — only on a
  // customer's first-ever Artist Membership subscription, so cancelling and
  // resubscribing through the app doesn't grant a fresh trial each time.
  const isFirstArtistSubscription =
    role === 'artist' && !(await db.collection('subscriptions').doc(`${uid}_artist`).get()).exists

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { firebaseUid: uid, planId, role },
      ...(isFirstArtistSubscription ? { trial_period_days: 14 } : {}),
    },
    metadata: { firebaseUid: uid, planId, role },
  })

  return { url: session.url }
})
