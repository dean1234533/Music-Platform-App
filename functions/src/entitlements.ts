import type { Timestamp } from 'firebase-admin/firestore'
import { db } from './admin.js'

export const PLAN_ROLES = ['fan', 'artist', 'dj'] as const
export type PlanRole = (typeof PLAN_ROLES)[number]

export const PLAN_TIERS = ['free', 'mid', 'top'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

/** Keep in sync with src/types/entitlements.ts — the two packages don't share a build. */
export const PLAN_FEATURE_KEYS = [
  'supporterContent',
  'earlyAccess',
  'polls',
  'artistDefinedPerks',
  'unlimitedTracks',
  'albumsEps',
  'scheduledReleases',
  'supporterOnlyTracks',
  'advancedAnalytics',
  'fixedCustomDjPricing',
  'teamAccess',
  'bulkDjOutreach',
  'privatePromoReleases',
  'releaseEmbargoes',
  'exportableAnalytics',
  'unlimitedDjRequests',
  'crates',
  'verifiedDjEligible',
  'advancedFiltering',
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

/** Single source of truth for Stripe's many statuses -> our coarse status, used by both the webhook and the resolver. */
export function mapSubscriptionStatus(status: string): 'active' | 'past_due' | 'canceled' | 'none' {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
    case 'paused':
      return 'canceled'
    default:
      return 'none'
  }
}

async function getDefaultFreePlan(role: PlanRole): Promise<PlanDoc | null> {
  const snap = await db
    .collection('subscriptionPlans')
    .where('role', '==', role)
    .where('isDefaultFree', '==', true)
    .limit(1)
    .get()
  if (snap.empty) return null
  return snap.docs[0]!.data() as PlanDoc
}

/**
 * The entitlement resolver. Reads subscriptions/{uid}_{role}; if it exists
 * and is active/past_due, resolves to its plan (falling back to free if that
 * plan was since deleted/deactivated). Otherwise resolves to the role's
 * isDefaultFree plan. No doc is written for free-tier users, so "no doc" is
 * the common case, not an error state.
 */
export async function resolveEffectivePlan(uid: string, role: PlanRole): Promise<{ plan: PlanDoc; status: ResolvedStatus }> {
  const subSnap = await db.collection('subscriptions').doc(`${uid}_${role}`).get()
  if (subSnap.exists) {
    const sub = subSnap.data()!
    const coarse = mapSubscriptionStatus(sub.status as string)
    if (coarse === 'active' || coarse === 'past_due') {
      const planId = sub.planId as string | null
      if (planId) {
        const planSnap = await db.collection('subscriptionPlans').doc(planId).get()
        if (planSnap.exists && planSnap.data()?.active) {
          return { plan: planSnap.data() as PlanDoc, status: coarse }
        }
      }
    }
  }
  const freePlan = await getDefaultFreePlan(role)
  if (!freePlan) {
    throw new Error(`No isDefaultFree subscriptionPlans doc configured for role "${role}" — run adminSeedSubscriptionPlans.`)
  }
  return { plan: freePlan, status: 'free' }
}

export async function hasFeature(uid: string, role: PlanRole, key: PlanFeatureKey): Promise<boolean> {
  const { plan } = await resolveEffectivePlan(uid, role)
  return plan.features?.[key] === true
}

/** -1 (UNLIMITED) means no cap. */
export async function getPlanLimit(uid: string, role: PlanRole, key: PlanLimitKey): Promise<number> {
  const { plan } = await resolveEffectivePlan(uid, role)
  return plan.limits?.[key] ?? 0
}

/** Cheap pre-check reading the already-mirrored artistProfiles fields rather than re-resolving the plan. */
export async function canUploadTrack(artistId: string): Promise<{ allowed: boolean; reason?: string }> {
  const snap = await db.collection('artistProfiles').doc(artistId).get()
  if (!snap.exists) return { allowed: false, reason: 'Artist profile not found.' }
  const data = snap.data()!
  const trackCount = (data.trackCount as number | undefined) ?? 0
  const trackLimit = (data.trackLimit as number | undefined) ?? 0
  if (trackLimit === UNLIMITED || trackCount < trackLimit) return { allowed: true }
  return { allowed: false, reason: 'Track upload limit reached for your current plan.' }
}

export function isSameCalendarMonth(ts: Timestamp | null | undefined, now = new Date()): boolean {
  if (!ts) return false
  const d = ts.toDate()
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
}

/** Non-transactional convenience read (display/pre-check use). submitLicenceRequest does its own transactional recheck+increment. */
export async function canRequestDjLicence(djId: string): Promise<{ allowed: boolean; reason?: string; remaining: number }> {
  const [{ plan }, djSnap] = await Promise.all([resolveEffectivePlan(djId, 'dj'), db.collection('djProfiles').doc(djId).get()])
  const limit = plan.limits?.djRequestsPerMonth ?? 0
  if (limit === UNLIMITED) return { allowed: true, remaining: UNLIMITED }
  const dj = djSnap.data() ?? {}
  const effectiveCount = isSameCalendarMonth(dj.requestsMonthResetAt as Timestamp | null) ? ((dj.requestsThisMonth as number) ?? 0) : 0
  const remaining = Math.max(0, limit - effectiveCount)
  return remaining > 0
    ? { allowed: true, remaining }
    : { allowed: false, reason: "You've reached your plan's monthly DJ request limit.", remaining: 0 }
}

export async function canAccessSupporterContent(fanId: string, artistId: string): Promise<boolean> {
  const snap = await db.collection('supportRelationships').doc(`${fanId}_${artistId}`).get()
  return snap.exists
}

export async function canUseAdvancedAnalytics(uid: string, role: 'artist' | 'dj'): Promise<boolean> {
  return hasFeature(uid, role, 'advancedAnalytics')
}

/**
 * Re-resolves uid's plan for role and mirrors the server-authoritative
 * fields Firestore rules (trackLimit) or display UI (planTier) need without
 * a second async plan lookup. Called from the Stripe webhook on every
 * subscription lifecycle event (upgrade/downgrade/cancellation all funnel
 * through it), and from onArtistProfileCreate/onDjProfileCreate for the
 * initial, pre-subscription free-tier bootstrap.
 */
export async function mirrorResolvedLimits(uid: string, role: PlanRole): Promise<void> {
  if (role === 'fan') return // no rules-enforced mirrored limit exists for the fan role today
  const { plan } = await resolveEffectivePlan(uid, role)
  if (role === 'artist') {
    const trackLimit = plan.limits?.maxActiveTracks ?? 0
    await db.collection('artistProfiles').doc(uid).update({ trackLimit, planTier: plan.tier })
  } else {
    await db.collection('djProfiles').doc(uid).update({ planTier: plan.tier })
  }
}
