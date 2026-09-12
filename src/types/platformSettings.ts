import type { Timestamp } from 'firebase/firestore'
import type { PlanFeatureKey, PlanLimitKey, PlanRole, PlanTier } from './entitlements'
import type { TrackVisibility } from './track'

export interface SubscriptionPlan {
  planId: string
  name: string
  role: PlanRole
  tier: PlanTier
  priceMinor: number
  currency: string
  interval: 'month' | 'year'
  /** Null for free plans — there's no Stripe Price for a £0 tier. */
  stripePriceId: string | null
  active: boolean
  /** The Free Listener fallback when no active supporter subscription exists. */
  isDefaultFree: boolean
  features: Partial<Record<PlanFeatureKey, boolean>>
  /** Optional cap for monthly artist allocation, bounded by the configured artist share. */
  limits: Partial<Record<PlanLimitKey, number>>
  displayOrder: number
  recommended: boolean
  updatedAt: Timestamp | null
}

export interface PlatformSettings {
  /** BackTheVibes' cut of every one-off fan support payment — see functions/src/support/checkout.ts. */
  platformFeePercent: number
  /** The artist's complementary share of a support payment (100 - platformFeePercent). Paid directly via Stripe Connect. */
  artistAllocationPercent: number
  djServiceFeePercent: number
  /** Falls back to 'followers' until an admin configures this. */
  defaultTrackVisibility?: TrackVisibility
}

export interface DataRetentionSettings {
  notificationsDays: number
  storyRecoveryDays: number
  inactiveChatMonths: number
  abandonedRequestMonths: number
  draftOfferMonths: number
  auditLogMonths: number
  contractYears: number
  copyrightClaimYears: number
}

/**
 * Placeholder revenue-split defaults the Cloud Function side now falls back to when
 * platformSettings/default hasn't been configured yet — mirrored here so the admin form
 * pre-fills with the values actually in effect right now, not blank fields that look
 * unconfigured when the system is really running on these defaults. Not a considered
 * business decision: review and adjust before relying on these for real payouts.
 */
export const DEFAULT_PLATFORM_FEES: Pick<
  PlatformSettings,
  'platformFeePercent' | 'artistAllocationPercent' | 'djServiceFeePercent'
> = {
  platformFeePercent: 20,
  artistAllocationPercent: 80,
  djServiceFeePercent: 10,
}

export const DEFAULT_DATA_RETENTION: DataRetentionSettings = {
  notificationsDays: 90,
  storyRecoveryDays: 7,
  inactiveChatMonths: 24,
  abandonedRequestMonths: 12,
  draftOfferMonths: 12,
  auditLogMonths: 24,
  contractYears: 6,
  copyrightClaimYears: 6,
}
