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
