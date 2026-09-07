import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { DEFAULT_DATA_RETENTION, type DataRetentionSettings, type PlatformSettings, type SubscriptionPlan } from '@/types/platformSettings'
import type { PlanRole } from '@/types/entitlements'

/**
 * Subscription prices are configured by an admin in Firestore, never
 * hard-coded in the client.
 */
export async function listActiveSubscriptionPlansForRole(role: PlanRole = 'fan'): Promise<SubscriptionPlan[]> {
  const q = query(collection(db, 'subscriptionPlans'), where('role', '==', role), where('active', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as SubscriptionPlan).sort((a, b) => a.displayOrder - b.displayOrder)
}

export async function getPlatformSettings(): Promise<PlatformSettings | null> {
  const snap = await getDoc(doc(db, 'platformSettings', 'default'))
  return snap.exists() ? (snap.data() as PlatformSettings) : null
}

/** Falls back to the documented suggested defaults until an admin configures real values. */
export async function getDataRetentionSettings(): Promise<DataRetentionSettings> {
  const snap = await getDoc(doc(db, 'platformSettings', 'dataRetention'))
  if (!snap.exists()) return DEFAULT_DATA_RETENTION
  return { ...DEFAULT_DATA_RETENTION, ...(snap.data() as Partial<DataRetentionSettings>) }
}
