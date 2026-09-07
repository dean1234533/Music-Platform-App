import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { SubscriptionDoc } from '@/types/subscription'

const startCheckout = callable<{ planId: string; successUrl: string; cancelUrl: string }, { url: string }>(
  'createCheckoutSession',
)
const startBillingPortal = callable<{ returnUrl: string }, { url: string }>('createBillingPortalSession')

export async function subscribeToPlan(planId: string): Promise<void> {
  const origin = window.location.origin
  const { url } = await startCheckout({
    planId,
    successUrl: `${origin}/app/subscription?checkout=success`,
    cancelUrl: `${origin}/app/subscription?checkout=cancelled`,
  })
  window.location.href = url
}

export async function openBillingPortal(): Promise<void> {
  const { url } = await startBillingPortal({ returnUrl: `${window.location.origin}/app/subscription` })
  window.location.href = url
}

export function subscribeToOwnSubscription(uid: string, onChange: (sub: SubscriptionDoc | null) => void) {
  return onSnapshot(doc(db, 'subscriptions', uid), (snap) => {
    onChange(snap.exists() ? (snap.data() as SubscriptionDoc) : null)
  })
}
