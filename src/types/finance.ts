import type { Timestamp } from 'firebase/firestore'

/**
 * `artist_support` and `dj_licence_income` are Stripe Connect destination
 * charges — the artist was already paid directly by Stripe; these records
 * are bookkeeping only, never an internal balance to draw down.
 * `artist_membership_income` is BackTheVibes' own platform-access fee and
 * is never shared with any artist (platformFeeMinor is always 0 on it).
 */
export type TransactionType = 'artist_support' | 'dj_licence_income' | 'artist_membership_income'

export interface TransactionDoc {
  transactionId: string
  type: TransactionType
  artistId: string
  fanId?: string
  djId?: string
  grossMinor: number
  platformFeeMinor: number
  netMinor: number
  currency: string
  createdAt: Timestamp | null
  refundedAt?: Timestamp | null
  refundedCustomerMinor?: number
}

export interface ArtistPayoutAccountDoc {
  artistId: string
  stripeAccountId: string
  payoutsEnabled: boolean
  chargesEnabled: boolean
  onboardingComplete: boolean
  updatedAt: Timestamp | null
}
