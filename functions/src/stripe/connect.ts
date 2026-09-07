import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { getStripe, stripeSecretKey } from './client.js'

function accountRef(artistId: string) {
  return db.collection('artistPayoutAccounts').doc(artistId)
}

/**
 * Stripe Connect Express onboarding. Only stripeAccountId and the three
 * status booleans are ever stored in Firestore — no bank details, no card
 * numbers; those live entirely on Stripe's side.
 */
export const createConnectOnboardingLink = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const artistId = request.auth.uid
  const { returnUrl, refreshUrl } = request.data ?? {}
  if (!returnUrl || !refreshUrl) throw new HttpsError('invalid-argument', 'returnUrl and refreshUrl are required.')

  const artistSnap = await db.collection('artistProfiles').doc(artistId).get()
  if (!artistSnap.exists) throw new HttpsError('failed-precondition', 'An artist profile is required.')

  const stripe = getStripe()
  const existing = await accountRef(artistId).get()
  let stripeAccountId = existing.data()?.stripeAccountId as string | undefined

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      metadata: { firebaseUid: artistId },
    })
    stripeAccountId = account.id
    await accountRef(artistId).set(
      {
        artistId,
        stripeAccountId,
        payoutsEnabled: false,
        chargesEnabled: false,
        onboardingComplete: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }

  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    type: 'account_onboarding',
    return_url: returnUrl,
    refresh_url: refreshUrl,
  })

  return { url: link.url }
})

export const createConnectDashboardLink = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const snap = await accountRef(request.auth.uid).get()
  const stripeAccountId = snap.data()?.stripeAccountId as string | undefined
  if (!stripeAccountId) throw new HttpsError('failed-precondition', 'No connected Stripe account found.')

  const loginLink = await getStripe().accounts.createLoginLink(stripeAccountId)
  return { url: loginLink.url }
})
