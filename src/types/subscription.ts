import type { Timestamp } from 'firebase/firestore'

export interface SubscriptionDoc {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  planId: string | null
  stripePriceId: string | null
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Timestamp | null
  updatedAt: Timestamp | null
}

export interface SupportAllocationDoc {
  fanId: string
  allocations: Record<string, number>
  totalMinor: number
  updatedAt: Timestamp | null
}
