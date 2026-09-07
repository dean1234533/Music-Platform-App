import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { SubscriptionDoc } from '@/types/subscription'

const startCheckout = callable<{ planId: string; role: 'fan'; successUrl: string; cancelUrl: string }, { url: string }>(
  'createCheckoutSession',
)
const startBillingPortal = callable<{ returnUrl: string }, { url: string }>('createBillingPortalSession')

export async function subscribeToPlan(planId: string): Promise<void> {
  const origin = window.location.origin
  const returnPath = '/app/subscription'
  const { url } = await startCheckout({
    planId,
    role: 'fan',
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
  onChange: (sub: SubscriptionDoc | null) => void,
) {
  return onSnapshot(doc(db, 'subscriptions', `${uid}_fan`), (snap) => {
    onChange(snap.exists() ? (snap.data() as SubscriptionDoc) : null)
  })
}
