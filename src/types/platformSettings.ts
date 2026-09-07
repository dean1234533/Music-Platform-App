import type { Timestamp } from 'firebase/firestore'
import type { PlanFeatureKey, PlanLimitKey, PlanRole, PlanTier } from './entitlements'

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
  /** Exactly one plan per role should have this set — the entitlement fallback when no active subscription exists. */
  isDefaultFree: boolean
  features: Partial<Record<PlanFeatureKey, boolean>>
  /** -1 means unlimited (see UNLIMITED sentinel in types/entitlements.ts). */
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
}
