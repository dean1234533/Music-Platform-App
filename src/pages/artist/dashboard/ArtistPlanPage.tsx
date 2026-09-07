import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listActiveSubscriptionPlansForRole } from '@/services/platformSettingsService'
import { openBillingPortal, subscribeToOwnSubscription, subscribeToPlan } from '@/services/subscriptionService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { SubscriptionPlan } from '@/types/platformSettings'
import type { SubscriptionDoc } from '@/types/subscription'

export function ArtistPlanPage() {
  const { firebaseUser } = useAuth()
  const [params] = useSearchParams()
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionDoc | null | undefined>(undefined)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    void listActiveSubscriptionPlansForRole('artist').then(setPlans)
  }, [])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeToOwnSubscription(firebaseUser.uid, 'artist', setSubscription)
  }, [firebaseUser])

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const activePlan = plans?.find((p) => p.planId === subscription?.planId) ?? null

  async function handleSubscribe(planId: string) {
    setCheckoutLoading(planId)
    setCheckoutError(null)
    try {
      await subscribeToPlan(planId, 'artist')
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Plan</h1>
        <p className="mt-1 text-sm text-ink-2">Starter is free forever — upgrade for unlimited uploads, advanced DJ licensing, and analytics.</p>
      </div>

      {params.get('checkout') === 'success' ? (
        <div className="rounded-xl border border-support-500/30 bg-support-500/5 px-4 py-3 text-sm text-ink-1">
          Thanks! It can take a few seconds for your plan to update below.
        </div>
      ) : null}

      {isActive ? (
        <div className="rounded-2xl border border-support-500/30 bg-support-500/5 p-6">
          <p className="text-sm text-ink-2">Current plan</p>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-lg font-semibold text-ink-0">{activePlan?.name ?? 'Active plan'}</p>
            <Button variant="secondary" size="sm" onClick={openBillingPortal}>Manage billing</Button>
          </div>
        </div>
      ) : null}

      {checkoutError ? <p className="text-sm text-danger-500">{checkoutError}</p> : null}

      {plans === null ? (
        <LoadingState />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-8 w-8 text-ink-3" />}
          title="No artist plans configured yet"
          description="The platform admin hasn't published pricing yet. Check back soon."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.planId === subscription?.planId && isActive
            return (
              <div key={plan.planId} className={`rounded-2xl border p-6 ${plan.recommended ? 'border-brand-500/50 bg-brand-500/5' : 'border-surface-border bg-surface-1'}`}>
                <h2 className="text-lg font-semibold text-ink-0">{plan.name}</h2>
                <p className="mt-2 text-2xl font-semibold text-ink-0">
                  {plan.priceMinor === 0 ? 'Free' : formatCurrency(plan.priceMinor, plan.currency)}
                  {plan.priceMinor > 0 ? <span className="text-sm font-normal text-ink-2">/{plan.interval}</span> : null}
                </p>
                <Button
                  className="mt-4 w-full"
                  variant={isCurrent ? 'secondary' : 'primary'}
                  disabled={isCurrent || plan.priceMinor === 0}
                  loading={checkoutLoading === plan.planId}
                  onClick={() => handleSubscribe(plan.planId)}
                >
                  {isCurrent ? 'Current plan' : plan.priceMinor === 0 ? 'Included' : 'Subscribe'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
