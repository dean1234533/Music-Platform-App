import Stripe from 'stripe'
import { defineSecret } from 'firebase-functions/params'

// Set with: firebase functions:secrets:set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
export const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY')
export const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET')

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (!cached) {
    // No pinned apiVersion — the SDK's bundled default keeps this in sync
    // with the installed `stripe` package version.
    cached = new Stripe(stripeSecretKey.value())
  }
  return cached
}
