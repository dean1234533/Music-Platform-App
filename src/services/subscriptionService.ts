import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { SubscriptionDoc } from '@/types/subscription'
import type { PlanRole } from '@/types/entitlements'

const startCheckout = callable<{ planId: string; role: PlanRole; successUrl: string; cancelUrl: string }, { url: string }>(
  'createCheckoutSession',
)
const startBillingPortal = callable<{ returnUrl: string }, { url: string }>('createBillingPortalSession')

const RETURN_PATH: Record<PlanRole, string> = {
  fan: '/app/subscription',
  artist: '/dashboard/artist/plan',
  dj: '/dj/plan',
}

export async function subscribeToPlan(planId: string, role: PlanRole): Promise<void> {
  const origin = window.location.origin
  const returnPath = RETURN_PATH[role]
  const { url } = await startCheckout({
    planId,
    role,
    successUrl: `${origin}${returnPath}?checkout=success`,
    cancelUrl: `${origin}${returnPath}?checkout=cancelled`,
  })
  window.location.href = url
}

export async function openBillingPortal(): Promise<void> {
  const { url } = await startBillingPortal({ returnUrl: window.location.href })
  window.location.href = url
}

export function subscribeToOwnSubscription(
  uid: string,
  role: PlanRole,
  onChange: (sub: SubscriptionDoc | null) => void,
) {
  return onSnapshot(doc(db, 'subscriptions', `${uid}_${role}`), (snap) => {
    onChange(snap.exists() ? (snap.data() as SubscriptionDoc) : null)
  })
}
