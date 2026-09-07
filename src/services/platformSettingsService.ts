import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SubscriptionPlan } from '@/types/platformSettings'

/**
 * Subscription prices are configured by an admin in Firestore, never
 * hard-coded in the client. Checkout itself is wired up in Phase 2 once
 * Stripe Checkout + webhooks exist — this only reads what's configured.
 */
export async function listActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const q = query(collection(db, 'subscriptionPlans'), where('active', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as SubscriptionPlan)
}
