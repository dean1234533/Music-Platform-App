import type { SubscriptionPlan } from './platformSettings'

export const PLAN_ROLES = ['fan', 'artist', 'dj'] as const
export type PlanRole = (typeof PLAN_ROLES)[number]

export const PLAN_TIERS = ['free', 'mid', 'top'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

/**
 * Keep in sync with functions/src/entitlements.ts's FEATURE_KEYS/LIMIT_KEYS —
 * the two packages don't share a build, so this vocabulary is duplicated
 * deliberately rather than pulled from a shared package.
 */
export const PLAN_FEATURE_KEYS = [
  // fan
  'supporterContent',
  'earlyAccess',
  'polls',
  'artistDefinedPerks',
  // artist — mid (Pro)
  'unlimitedTracks',
  'albumsEps',
  'scheduledReleases',
  'supporterOnlyTracks',
  'advancedAnalytics',
  'fixedCustomDjPricing',
  // artist — top (Pro+)
  'teamAccess',
  'bulkDjOutreach',
  'privatePromoReleases',
  'releaseEmbargoes',
  'exportableAnalytics',
  // dj — mid (Pro)
  'unlimitedDjRequests',
  'crates',
  'verifiedDjEligible',
  'advancedFiltering',
  // dj — top (Pro+)
  'privatePromoPools',
  'advancedCrates',
  'professionalAnalytics',
  'priorityAccess',
] as const

export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number]

export const PLAN_LIMIT_KEYS = ['maxActiveTracks', 'djRequestsPerMonth', 'supportAllocationCapMinor'] as const

export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number]

/** Sentinel used in a plan's `limits` map to mean "no cap." */
export const UNLIMITED = -1

export type ResolvedSubscriptionStatus = 'active' | 'past_due' | 'free'

export interface ResolvedEntitlement {
  plan: SubscriptionPlan
  status: ResolvedSubscriptionStatus
}
