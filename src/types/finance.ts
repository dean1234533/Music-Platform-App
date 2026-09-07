import type { Timestamp } from 'firebase/firestore'

export type TransactionType = 'subscription_income' | 'dj_licence_income' | 'payout'

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
  promotedAt: Timestamp | null
}

export interface ArtistBalanceDoc {
  artistId: string
  pendingMinor: number
  availableMinor: number
  paidMinor: number
  currency: string
  updatedAt: Timestamp | null
}

export interface PayoutDoc {
  payoutId: string
  artistId: string
  amountMinor: number
  currency: string
  stripeTransferId: string
  status: string
  createdAt: Timestamp | null
}

export interface ArtistPayoutAccountDoc {
  artistId: string
  stripeAccountId: string
  payoutsEnabled: boolean
  chargesEnabled: boolean
  onboardingComplete: boolean
  updatedAt: Timestamp | null
}
