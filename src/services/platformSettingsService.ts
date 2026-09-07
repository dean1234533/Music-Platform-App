import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SubscriptionPlan } from '@/types/platformSettings'
import type { PlanRole } from '@/types/entitlements'

/**
 * Subscription prices are configured by an admin in Firestore, never
 * hard-coded in the client.
 */
export async function listActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const q = query(collection(db, 'subscriptionPlans'), where('active', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as SubscriptionPlan)
}

export async function listActiveSubscriptionPlansForRole(role: PlanRole): Promise<SubscriptionPlan[]> {
  const q = query(collection(db, 'subscriptionPlans'), where('role', '==', role), where('active', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as SubscriptionPlan).sort((a, b) => a.displayOrder - b.displayOrder)
}
