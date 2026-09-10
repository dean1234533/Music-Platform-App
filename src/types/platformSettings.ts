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
  platformFeePercent: number
  artistAllocationPercent: number
  djServiceFeePercent: number
  minimumPayoutMinor: number
  allowedPreviewDurationsSec: number[]
  maxUploadSizeMB: number
  supportedAudioTypes: string[]
  /** Falls back to PREVIEW_DEFAULT_DURATION_SEC/'followers' until an admin configures these. */
  defaultTrackVisibility?: TrackVisibility
  defaultPreviewDurationSec?: number
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
  'platformFeePercent' | 'artistAllocationPercent' | 'djServiceFeePercent' | 'minimumPayoutMinor'
> = {
  platformFeePercent: 15,
  artistAllocationPercent: 85,
  djServiceFeePercent: 10,
  minimumPayoutMinor: 2000,
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
