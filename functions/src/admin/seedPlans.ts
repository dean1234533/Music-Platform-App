import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'
import type { PlanDoc } from '../entitlements.js'

/**
 * Fans never pay a subscription any more — supporting an artist is a
 * one-off Stripe Connect payment (functions/src/support/checkout.ts), never
 * a recurring platform fee. fan_free is kept only as the always-on fallback
 * `resolveEffectivePlan`/`useFanFeature` resolve to (with every feature
 * granted, since there is no paid tier left to gate them behind) — Artist
 * Membership is the only real subscription product left.
 */
export const SEED_PLANS: PlanDoc[] = [
  {
    planId: 'fan_free', name: 'Free Listener', role: 'fan', tier: 'free', priceMinor: 0,
    currency: 'gbp', interval: 'month', stripePriceId: null, active: true, isDefaultFree: true,
    features: { supporterContent: true, earlyAccess: true, polls: true, artistDefinedPerks: true },
    limits: {}, displayOrder: 0, recommended: false,
  },
  {
    planId: 'artist_membership', name: 'Artist Membership', role: 'artist', tier: 'mid', priceMinor: 2999,
    currency: 'gbp', interval: 'year', stripePriceId: 'price_1UDe4DF82zwiwbNndVjL9sLP', active: true, isDefaultFree: false,
    features: {}, limits: {}, displayOrder: 0, recommended: true,
  },
]

const LEGACY_PLAN_IDS = ['fan_supporter', 'fan_super_supporter', 'artist_starter', 'artist_pro', 'artist_pro_plus', 'dj_free', 'dj_pro', 'dj_pro_plus']

/** Seeds the current plans and retires every legacy/paid-fan-tier plan. */
export const adminSeedSubscriptionPlans = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const seeded: string[] = []
  const updated: string[] = []
  const retired: string[] = []
  const batch = db.batch()

  for (const plan of SEED_PLANS) {
    const ref = db.collection('subscriptionPlans').doc(plan.planId)
    const existing = await ref.get()
    if (existing.exists) {
      // fan_free's features are kept in sync even on an existing doc — it's
      // the app's one remaining fallback plan, not an admin-customised
      // paid tier, so there's nothing here for an admin edit to clobber.
      if (plan.planId === 'fan_free') {
        batch.set(ref, { features: plan.features, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        updated.push(plan.planId)
      }
    } else {
      batch.set(ref, { ...plan, updatedAt: FieldValue.serverTimestamp() })
      seeded.push(plan.planId)
    }
  }
  for (const planId of LEGACY_PLAN_IDS) {
    const ref = db.collection('subscriptionPlans').doc(planId)
    const existing = await ref.get()
    if (existing.exists && existing.data()?.active !== false) {
      batch.set(ref, { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      retired.push(planId)
    }
  }

  if (seeded.length > 0 || updated.length > 0 || retired.length > 0) await batch.commit()
  await writeAuditLog(adminId, 'sync_fan_subscription_plans', { seeded, updated, retired })
  return { ok: true, seeded, updated, retired }
})
