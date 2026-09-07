import type { Timestamp } from 'firebase/firestore'

export type DealPriceType = 'free' | 'fixed' | 'starting_from' | 'negotiable' | 'custom_quote'

export interface DjDealDoc {
  dealId: string
  artistId: string
  name: string
  description: string
  priceType: DealPriceType
  /** Only meaningful for 'fixed'/'starting_from'; null otherwise. */
  priceMinor: number | null
  currency: string
  permittedUse: string
  territory: string
  durationDays: number | null
  startRule: string
  expiryRule: string
  venueRestrictions: string
  recordingPermission: boolean
  streamingPermission: boolean
  promotionalMixPermission: boolean
  attributionRequirements: string
  redistributionAllowed: boolean
  resaleAllowed: boolean
  remixAllowed: boolean
  additionalTerms: string
  active: boolean
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/** Per-track configuration layered on top of the existing djPromotion/djLicenceMode fields. */
export interface TrackDjDealSettings {
  acceptDjRequests: boolean
  allowedDealIds: string[]
  defaultDealId: string | null
  minimumPriceMinor: number | null
  verifiedDjsOnly: boolean
  customApprovalRequired: boolean
}
