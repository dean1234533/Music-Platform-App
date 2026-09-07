import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import type Stripe from 'stripe'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { getStripe, stripeSecretKey } from './client.js'
import { defineSecret } from 'firebase-functions/params'

export const stripeConnectWebhookSecret = defineSecret('STRIPE_CONNECT_WEBHOOK_SECRET')

/**
 * Separate webhook endpoint for Connect account events (configure this URL
 * as its own Stripe webhook listening to "Connect" events, distinct from
 * the platform webhook above). Keeps payoutsEnabled/chargesEnabled/
 * onboardingComplete in sync with what Stripe has actually verified —
 * never toggled by the client.
 */
export const stripeConnectWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeConnectWebhookSecret] },
  async (req, res) => {
    const signature = req.headers['stripe-signature']
    if (!signature || typeof signature !== 'string') {
      res.status(400).send('Missing signature')
      return
    }

    let event: Stripe.Event
    try {
      event = getStripe().webhooks.constructEvent(req.rawBody, signature, stripeConnectWebhookSecret.value())
    } catch (err) {
      logger.error('Stripe Connect webhook signature verification failed', err)
      res.status(400).send('Invalid signature')
      return
    }

    try {
      if (event.type === 'account.updated') {
        const account = event.data.object as Stripe.Account
        const artistId = account.metadata?.firebaseUid
        if (artistId) {
          await db.collection('artistPayoutAccounts').doc(artistId).set(
            {
              payoutsEnabled: account.payouts_enabled ?? false,
              chargesEnabled: account.charges_enabled ?? false,
              onboardingComplete: account.details_submitted ?? false,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
        }
      }
      res.status(200).send('ok')
    } catch (err) {
      logger.error('Stripe Connect webhook handler error', err)
      res.status(500).send('Internal error')
    }
  },
)
