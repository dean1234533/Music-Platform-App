import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from '../admin.js'
import { getStripe, stripeSecretKey } from './client.js'

interface SubscriptionPlanDoc {
  planId: string
  stripePriceId: string
  active: boolean
}

/**
 * Creates a Stripe Checkout Session for a platform subscription plan. The
 * client only ever receives back a redirect URL — no Stripe secret key, no
 * price/amount trust decisions happen here beyond looking up the plan the
 * admin actually configured.
 */
export const createCheckoutSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid
  const planId = request.data?.planId as string | undefined
  const successUrl = request.data?.successUrl as string | undefined
  const cancelUrl = request.data?.cancelUrl as string | undefined
  if (!planId || !successUrl || !cancelUrl) {
    throw new HttpsError('invalid-argument', 'planId, successUrl, and cancelUrl are required.')
  }

  const planSnap = await db.collection('subscriptionPlans').doc(planId).get()
  if (!planSnap.exists) throw new HttpsError('not-found', 'Subscription plan not found.')
  const plan = planSnap.data() as SubscriptionPlanDoc
  if (!plan.active) throw new HttpsError('failed-precondition', 'This plan is no longer available.')

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

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: { metadata: { firebaseUid: uid, planId } },
    metadata: { firebaseUid: uid, planId },
  })

  return { url: session.url }
})
