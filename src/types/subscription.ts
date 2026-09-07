import type { Timestamp } from 'firebase/firestore'
import type { PlanRole } from './entitlements'

/** Doc ID is `${userId}_${role}` — a user can hold up to 3 concurrent subscriptions, one per role. */
export interface SubscriptionDoc {
  userId: string
  role: PlanRole
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
