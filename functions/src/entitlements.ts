import { db } from './admin.js'

export const PLAN_ROLES = ['fan', 'artist'] as const
export type PlanRole = (typeof PLAN_ROLES)[number]
export const PLAN_TIERS = ['free', 'mid', 'top'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]
export const PLAN_FEATURE_KEYS = ['supporterContent', 'earlyAccess', 'polls', 'artistDefinedPerks'] as const
export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number]
export const PLAN_LIMIT_KEYS = ['supportAllocationCapMinor'] as const
export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number]

export interface PlanDoc {
  planId: string
  name: string
  role: PlanRole
  tier: PlanTier
  priceMinor: number
  currency: string
  interval: 'month' | 'year'
  stripePriceId: string | null
  active: boolean
  isDefaultFree: boolean
  features: Partial<Record<PlanFeatureKey, boolean>>
  limits: Partial<Record<PlanLimitKey, number>>
  displayOrder: number
  recommended: boolean
}

export type ResolvedStatus = 'active' | 'past_due' | 'free'

export function mapSubscriptionStatus(status: string): 'active' | 'past_due' | 'canceled' | 'none' {
  switch (status) {
    case 'active': case 'trialing': return 'active'
    case 'past_due': case 'unpaid': case 'incomplete': return 'past_due'
    case 'canceled': case 'incomplete_expired': case 'paused': return 'canceled'
    default: return 'none'
  }
}

async function getDefaultFreePlan(): Promise<PlanDoc | null> {
  const snap = await db.collection('subscriptionPlans').where('role', '==', 'fan').where('isDefaultFree', '==', true).limit(1).get()
  return snap.empty ? null : (snap.docs[0]!.data() as PlanDoc)
}

/** Resolves a fan's paid supporter subscription, falling back to Free Listener. */
export async function resolveEffectivePlan(uid: string, role: PlanRole = 'fan'): Promise<{ plan: PlanDoc; status: ResolvedStatus }> {
  const subSnap = await db.collection('subscriptions').doc(`${uid}_${role}`).get()
  if (subSnap.exists) {
    const sub = subSnap.data()!
    const coarse = mapSubscriptionStatus(sub.status as string)
    if (coarse === 'active' || coarse === 'past_due') {
      const planId = sub.planId as string | null
      if (planId) {
        const planSnap = await db.collection('subscriptionPlans').doc(planId).get()
        const plan = planSnap.data() as PlanDoc | undefined
        if (planSnap.exists && plan?.active && plan.role === 'fan') return { plan, status: coarse }
      }
    }
  }
  const freePlan = await getDefaultFreePlan()
  if (!freePlan) throw new Error('No default Free Listener plan is configured — run adminSeedSubscriptionPlans.')
  return { plan: freePlan, status: 'free' }
}

export async function canAccessSupporterContent(fanId: string, artistId: string): Promise<boolean> {
  return (await db.collection('supportRelationships').doc(`${fanId}_${artistId}`).get()).exists
}
