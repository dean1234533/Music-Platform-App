import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import { getStripe, stripeSecretKey } from './client.js'

export const createBillingPortalSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const returnUrl = request.data?.returnUrl as string | undefined
  if (!returnUrl) throw new HttpsError('invalid-argument', 'returnUrl is required.')

  const userSnap = await db.collection('users').doc(request.auth.uid).get()
  const customerId = userSnap.data()?.stripeCustomerId as string | undefined
  if (!customerId) throw new HttpsError('failed-precondition', 'No billing account found.')

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return { url: session.url }
})
