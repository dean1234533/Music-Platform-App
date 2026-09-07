export interface SubscriptionPlan {
  planId: string
  name: string
  priceMinor: number
  currency: string
  interval: 'month' | 'year'
  stripePriceId: string
  active: boolean
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
