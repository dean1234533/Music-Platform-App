import type { ReactNode } from 'react'
import { useEntitlement } from '@/hooks/useEntitlements'
import { LoadingState } from '@/components/common/StateViews'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import type { PlanFeatureKey, PlanRole } from '@/types/entitlements'

/**
 * Entitlement-aware route guard, alongside RoleRoute. Reserved for the rare
 * case of a whole page being tier-exclusive (e.g. DJ Pro+ analytics) — most
 * feature gating within an existing page should use useEntitlement inline
 * instead of wrapping the whole page.
 */
export function TierRoute({
  role,
  requiredFeature,
  reason,
  cta = 'Upgrade',
  children,
}: {
  role: PlanRole
  requiredFeature: PlanFeatureKey
  reason: string
  cta?: string
  children: ReactNode
}) {
  const { hasFeature, status } = useEntitlement(role)

  if (status === 'loading') return <LoadingState />
  if (!hasFeature(requiredFeature)) {
    return (
      <div className="flex flex-col gap-4">
        <UpgradePrompt role={role} reason={reason} cta={cta} />
      </div>
    )
  }
  return <>{children}</>
}
