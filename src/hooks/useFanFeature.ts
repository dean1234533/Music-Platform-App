import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { listActiveSubscriptionPlansForRole } from '@/services/platformSettingsService'
import { subscribeToOwnSubscription } from '@/services/subscriptionService'
import type { PlanFeatureKey } from '@/types/entitlements'
import type { SubscriptionPlan } from '@/types/platformSettings'
import type { SubscriptionDoc } from '@/types/subscription'

/**
 * Whether the signed-in fan's own plan includes a given feature (e.g. artistDefinedPerks) —
 * distinct from per-artist follow/support status. undefined while still loading, so callers
 * can avoid a flash of the locked state before the real answer is known.
 */
export function useFanFeature(feature: PlanFeatureKey): boolean | undefined {
  const { firebaseUser } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionDoc | null | undefined>(undefined)

  useEffect(() => {
    void listActiveSubscriptionPlansForRole('fan').then(setPlans)
  }, [])

  useEffect(() => {
    if (!firebaseUser) {
      setSubscription(null)
      return
    }
    return subscribeToOwnSubscription(firebaseUser.uid, setSubscription)
  }, [firebaseUser])

  if (plans === null || subscription === undefined) return undefined
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const activePlan = plans.find((p) => p.planId === subscription?.planId)
  return Boolean(isActive && activePlan?.features[feature])
}
