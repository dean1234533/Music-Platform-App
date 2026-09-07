import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'
import { UNLIMITED, type PlanDoc } from '../entitlements.js'

type SeedPlan = Omit<PlanDoc, 'stripePriceId'> & { stripePriceId: null }

/**
 * The 9 plans from the pricing spec. `stripePriceId` is left null for the 6
 * paid plans — an admin must create the corresponding Stripe Prices by hand
 * (this environment has no Stripe API access) and paste the IDs into the
 * admin Plans UI afterwards.
 */
const SEED_PLANS: SeedPlan[] = [
  {
    planId: 'fan_free',
    name: 'Free Listener',
    role: 'fan',
    tier: 'free',
    priceMinor: 0,
    currency: 'gbp',
    interval: 'month',
    stripePriceId: null,
    active: true,
    isDefaultFree: true,
    features: {},
    limits: { supportAllocationCapMinor: 0 },
    displayOrder: 0,
    recommended: false,
  },
  {
    planId: 'fan_supporter',
    name: 'Supporter',
    role: 'fan',
    tier: 'mid',
    priceMinor: 799,
    currency: 'gbp',
    interval: 'month',
    stripePriceId: null,
    active: true,
    isDefaultFree: false,
    features: { supporterContent: true, earlyAccess: true, polls: true, artistDefinedPerks: true },
    limits: {},
    displayOrder: 1,
    recommended: true,
  },
  {
    planId: 'fan_super_supporter',
    name: 'Super Supporter',
    role: 'fan',
    tier: 'top',
    priceMinor: 1499,
    currency: 'gbp',
    interval: 'month',
    stripePriceId: null,
    active: true,
    isDefaultFree: false,
    features: { supporterContent: true, earlyAccess: true, polls: true, artistDefinedPerks: true },
    limits: {},
    displayOrder: 2,
    recommended: false,
  },
  {
    planId: 'artist_starter',
    name: 'Artist Starter',
    role: 'artist',
    tier: 'free',
    priceMinor: 0,
    currency: 'gbp',
    interval: 'month',
    stripePriceId: null,
    active: true,
    isDefaultFree: true,
    features: {},
    limits: { maxActiveTracks: 5 },
    displayOrder: 0,
    recommended: false,
  },
  {
    planId: 'artist_pro',
    name: 'Artist Pro',
    role: 'artist',
    tier: 'mid',
    priceMinor: 999,
    currency: 'gbp',
    interval: 'month',
    stripePriceId: null,
    active: true,
    isDefaultFree: false,
    features: {
      unlimitedTracks: true,
      albumsEps: true,
      scheduledReleases: true,
      supporterOnlyTracks: true,
      advancedAnalytics: true,
      fixedCustomDjPricing: true,
    },
    limits: { maxActiveTracks: UNLIMITED },
    displayOrder: 1,
    recommended: true,
  },
  {
    planId: 'artist_pro_plus',
    name: 'Artist Pro+',
    role: 'artist',
    tier: 'top',
    priceMinor: 1999,
    currency: 'gbp',
    interval: 'month',
    stripePriceId: null,
    active: true,
    isDefaultFree: false,
    features: {
      unlimitedTracks: true,
      albumsEps: true,
      scheduledReleases: true,
      supporterOnlyTracks: true,
      advancedAnalytics: true,
      fixedCustomDjPricing: true,
      teamAccess: true,
      bulkDjOutreach: true,
      privatePromoReleases: true,
      releaseEmbargoes: true,
      exportableAnalytics: true,
    },
    limits: { maxActiveTracks: UNLIMITED },
    displayOrder: 2,
    recommended: false,
  },
  {
    planId: 'dj_free',
    name: 'DJ Free',
    role: 'dj',
    tier: 'free',
    priceMinor: 0,
    currency: 'gbp',
    interval: 'month',
    stripePriceId: null,
    active: true,
    isDefaultFree: true,
    features: {},
    limits: { djRequestsPerMonth: 5 },
    displayOrder: 0,
    recommended: false,
  },
  {
    planId: 'dj_pro',
    name: 'DJ Pro',
    role: 'dj',
    tier: 'mid',
    priceMinor: 999,
    currency: 'gbp',
    interval: 'month',
    stripePriceId: null,
    active: true,
    isDefaultFree: false,
    features: { unlimitedDjRequests: true, crates: true, verifiedDjEligible: true, advancedFiltering: true },
    limits: { djRequestsPerMonth: UNLIMITED },
    displayOrder: 1,
    recommended: true,
  },
  {
    planId: 'dj_pro_plus',
    name: 'DJ Pro+',
    role: 'dj',
    tier: 'top',
    priceMinor: 1999,
    currency: 'gbp',
    interval: 'month',
    stripePriceId: null,
    active: true,
    isDefaultFree: false,
    features: {
      unlimitedDjRequests: true,
      crates: true,
      verifiedDjEligible: true,
      advancedFiltering: true,
      privatePromoPools: true,
      advancedCrates: true,
      professionalAnalytics: true,
      priorityAccess: true,
    },
    limits: { djRequestsPerMonth: UNLIMITED },
    displayOrder: 2,
    recommended: false,
  },
]

/**
 * Idempotent: skips (never overwrites) any plan doc that already exists, so
 * re-running this after an admin has customized a plan's price/features
 * never clobbers their edits. Safe to call repeatedly, e.g. after adding a
 * new plan to SEED_PLANS in a future release.
 */
export const adminSeedSubscriptionPlans = onCall(async (request) => {
  const adminId = await requireAdmin(request)

  const seeded: string[] = []
  const skipped: string[] = []
  const batch = db.batch()

  for (const plan of SEED_PLANS) {
    const ref = db.collection('subscriptionPlans').doc(plan.planId)
    const existing = await ref.get()
    if (existing.exists) {
      skipped.push(plan.planId)
      continue
    }
    batch.set(ref, { ...plan, updatedAt: FieldValue.serverTimestamp() })
    seeded.push(plan.planId)
  }

  if (seeded.length > 0) await batch.commit()
  await writeAuditLog(adminId, 'seed_subscription_plans', { seeded, skipped })
  return { ok: true, seeded, skipped }
})
