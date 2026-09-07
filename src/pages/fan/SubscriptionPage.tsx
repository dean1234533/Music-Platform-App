import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listActiveSubscriptionPlans } from '@/services/platformSettingsService'
import { openBillingPortal, subscribeToOwnSubscription, subscribeToPlan } from '@/services/subscriptionService'
import { subscribeSupportAllocations, updateSupportAllocations } from '@/services/supportService'
import { listFollowedArtistIds } from '@/services/followService'
import { getArtistProfile } from '@/services/artistService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { SubscriptionPlan } from '@/types/platformSettings'
import type { SubscriptionDoc, SupportAllocationDoc } from '@/types/subscription'
import type { ArtistProfile } from '@/types/artist'

export function SubscriptionPage() {
  const { firebaseUser } = useAuth()
  const [params] = useSearchParams()
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionDoc | null | undefined>(undefined)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    void listActiveSubscriptionPlans().then(setPlans)
  }, [])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeToOwnSubscription(firebaseUser.uid, setSubscription)
  }, [firebaseUser])

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const activePlan = plans?.find((p) => p.planId === subscription?.planId) ?? null

  async function handleSubscribe(planId: string) {
    setCheckoutLoading(planId)
    try {
      await subscribeToPlan(planId)
    } finally {
      setCheckoutLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Subscription</h1>
        <p className="mt-1 text-sm text-ink-2">Choose a plan and decide which artists your subscription supports.</p>
      </div>

      {params.get('checkout') === 'success' ? (
        <div className="rounded-xl border border-support-500/30 bg-support-500/5 px-4 py-3 text-sm text-ink-1">
          Thanks for subscribing! It can take a few seconds for your status to update below.
        </div>
      ) : null}

      {isActive ? (
        <div className="rounded-2xl border border-support-500/30 bg-support-500/5 p-6">
          <p className="text-sm text-ink-2">Current plan</p>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-lg font-semibold text-ink-0">{activePlan?.name ?? 'Active subscription'}</p>
            <Button variant="secondary" size="sm" onClick={openBillingPortal}>
              Manage billing
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-warning-500/30 bg-warning-500/5 px-4 py-3 text-sm text-ink-1">
            Subscribing requires a live Stripe account connected to this Firebase project (test mode
            works fine for trying it out).
          </div>

          {plans === null ? (
            <LoadingState />
          ) : plans.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-8 w-8 text-ink-3" />}
              title="No subscription plans configured yet"
              description="The platform admin hasn't published pricing yet. Check back soon."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => (
                <div key={plan.planId} className="rounded-2xl border border-surface-border bg-surface-1 p-6">
                  <h2 className="text-lg font-semibold text-ink-0">{plan.name}</h2>
                  <p className="mt-2 text-2xl font-semibold text-ink-0">
                    {formatCurrency(plan.priceMinor, plan.currency)}
                    <span className="text-sm font-normal text-ink-2">/{plan.interval}</span>
                  </p>
                  <Button
                    className="mt-4 w-full"
                    loading={checkoutLoading === plan.planId}
                    onClick={() => handleSubscribe(plan.planId)}
                  >
                    Subscribe
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {isActive && activePlan ? <AllocationEditor fanId={firebaseUser!.uid} planCapMinor={activePlan.priceMinor} currency={activePlan.currency} /> : null}
    </div>
  )
}

function AllocationEditor({ fanId, planCapMinor, currency }: { fanId: string; planCapMinor: number; currency: string }) {
  const [artists, setArtists] = useState<ArtistProfile[]>([])
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const ids = await listFollowedArtistIds(fanId)
      const profiles = await Promise.all(ids.map((id) => getArtistProfile(id)))
      if (!cancelled) {
        setArtists(profiles.filter((p): p is ArtistProfile => p !== null))
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [fanId])

  useEffect(() => {
    return subscribeSupportAllocations(fanId, (doc: SupportAllocationDoc | null) => {
      if (doc) setAmounts(doc.allocations)
    })
  }, [fanId])

  const totalMinor = useMemo(() => Object.values(amounts).reduce((sum, v) => sum + (v || 0), 0), [amounts])
  const overCap = totalMinor > planCapMinor

  function setAmount(artistId: string, majorUnits: string) {
    const minor = Math.max(0, Math.round(Number(majorUnits || 0) * 100))
    setAmounts((prev) => ({ ...prev, [artistId]: minor }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await updateSupportAllocations(
        Object.entries(amounts)
          .filter(([, amountMinor]) => amountMinor > 0)
          .map(([artistId, amountMinor]) => ({ artistId, amountMinor })),
      )
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your allocation.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label="Loading your artists…" />

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-ink-0">Your artist support this month</h2>
      <p className="mb-4 text-sm text-ink-2">
        Split your subscription across the artists you follow. Unallocated amounts stay with the
        platform this cycle.
      </p>

      {artists.length === 0 ? (
        <EmptyState title="Follow some artists first" description="You can only support artists you follow." />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {artists.map((artist) => (
            <div key={artist.artistId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-medium text-ink-0">{artist.name}</span>
              <div className="flex items-center gap-1 text-sm text-ink-2">
                {currency === 'gbp' ? '£' : currency.toUpperCase() + ' '}
                <input
                  type="number"
                  min={0}
                  step="0.50"
                  value={((amounts[artist.artistId] ?? 0) / 100).toFixed(2)}
                  onChange={(e) => setAmount(artist.artistId, e.target.value)}
                  className="w-20 rounded-lg border border-surface-border bg-surface-2 px-2 py-1 text-right text-ink-0"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className={overCap ? 'text-danger-500' : 'text-ink-2'}>
          Total: {formatCurrency(totalMinor, currency)} / {formatCurrency(planCapMinor, currency)}
        </span>
      </div>

      {error ? <p className="mt-2 text-sm text-danger-500">{error}</p> : null}
      {saved ? <p className="mt-2 text-sm text-support-400">Saved.</p> : null}
      <Button className="mt-3" onClick={handleSave} loading={saving} disabled={overCap || artists.length === 0}>
        Save allocation
      </Button>
    </div>
  )
}
