import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'
import type { PlanDoc } from '../entitlements.js'

type SeedPlan = Omit<PlanDoc, 'stripePriceId'> & { stripePriceId: null }

const SEED_PLANS: SeedPlan[] = [
  {
    planId: 'fan_free', name: 'Free Listener', role: 'fan', tier: 'free', priceMinor: 0,
    currency: 'gbp', interval: 'month', stripePriceId: null, active: true, isDefaultFree: true,
    features: {}, limits: { supportAllocationCapMinor: 0 }, displayOrder: 0, recommended: false,
  },
  {
    planId: 'fan_supporter', name: 'Supporter', role: 'fan', tier: 'mid', priceMinor: 499,
    currency: 'gbp', interval: 'month', stripePriceId: null, active: true, isDefaultFree: false,
    features: { supporterContent: true, earlyAccess: true, polls: true, artistDefinedPerks: true },
    limits: {}, displayOrder: 1, recommended: true,
  },
]

const LEGACY_PLAN_IDS = ['fan_super_supporter', 'artist_starter', 'artist_pro', 'artist_pro_plus', 'dj_free', 'dj_pro', 'dj_pro_plus']

/** Seeds the launch Supporter offer and retires legacy creator/DJ plans. */
export const adminSeedSubscriptionPlans = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const seeded: string[] = []
  const skipped: string[] = []
  const retired: string[] = []
  const batch = db.batch()

  for (const plan of SEED_PLANS) {
    const ref = db.collection('subscriptionPlans').doc(plan.planId)
    const existing = await ref.get()
    if (existing.exists) skipped.push(plan.planId)
    else {
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

  if (seeded.length > 0 || retired.length > 0) await batch.commit()
  await writeAuditLog(adminId, 'sync_fan_subscription_plans', { seeded, skipped, retired })
  return { ok: true, seeded, skipped, retired }
})
