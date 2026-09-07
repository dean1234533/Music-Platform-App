import type { Timestamp } from 'firebase/firestore'

export type FanOfferAudience = 'everyone' | 'followers' | 'supporters'
export type FanOfferKind = 'exclusive' | 'early_access' | 'discount' | 'event' | 'merch' | 'other'

export interface FanOfferDoc {
  offerId: string
  artistId: string
  title: string
  description: string
  audience: FanOfferAudience
  kind: FanOfferKind
  redemption: string
  expiresAt: Timestamp | null
  createdAt: Timestamp | null
}

export interface FanOfferClaimDoc {
  claimId: string
  offerId: string
  artistId: string
  fanId: string
  createdAt: Timestamp | null
}
