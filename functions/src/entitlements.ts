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

export function mapSubscriptionStatus(status: string): 'active' | 'past_due' | 'canceled' | 'none' {
  switch (status) {
    case 'active': case 'trialing': return 'active'
    case 'past_due': case 'unpaid': case 'incomplete': return 'past_due'
    case 'canceled': case 'incomplete_expired': case 'paused': return 'canceled'
    default: return 'none'
  }
}
