import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { listActiveSubscriptionPlansForRole } from '@/services/platformSettingsService'
import type { PlanFeatureKey } from '@/types/entitlements'

/**
 * Whether the signed-in fan's plan includes a given feature (e.g.
 * artistDefinedPerks). Fans never hold a paid subscription any more —
 * fan_free is the one plan every signed-in fan is always on — so this reads
 * that plan's features directly rather than checking for an active
 * subscription doc that no longer gets created. undefined while still
 * loading, so callers can avoid a flash of the locked state before the real
 * answer is known.
 */
export function useFanFeature(feature: PlanFeatureKey): boolean | undefined {
  const { firebaseUser } = useAuth()
  const [hasFeature, setHasFeature] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!firebaseUser) {
      setHasFeature(false)
      return
    }
    let cancelled = false
    void listActiveSubscriptionPlansForRole('fan').then((plans) => {
      if (cancelled) return
      const freePlan = plans.find((p) => p.isDefaultFree)
      setHasFeature(Boolean(freePlan?.features[feature]))
    })
    return () => {
      cancelled = true
    }
  }, [firebaseUser, feature])

  return hasFeature
}
