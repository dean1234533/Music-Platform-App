import type { SubscriptionPlan } from './platformSettings'

/** Recurring subscriptions belong to listeners only. Artist and DJ accounts are free. */
export const PLAN_ROLES = ['fan'] as const
export type PlanRole = (typeof PLAN_ROLES)[number]

export const PLAN_TIERS = ['free', 'mid', 'top'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

/**
 * Keep in sync with functions/src/entitlements.ts's FEATURE_KEYS/LIMIT_KEYS —
 * the two packages don't share a build, so this vocabulary is duplicated
 * deliberately rather than pulled from a shared package.
 */
export const PLAN_FEATURE_KEYS = [
  'supporterContent',
  'earlyAccess',
  'polls',
  'artistDefinedPerks',
] as const

export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number]

export const PLAN_LIMIT_KEYS = ['supportAllocationCapMinor'] as const

export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number]

export type ResolvedSubscriptionStatus = 'active' | 'past_due' | 'free'

export interface ResolvedEntitlement {
  plan: SubscriptionPlan
  status: ResolvedSubscriptionStatus
}
