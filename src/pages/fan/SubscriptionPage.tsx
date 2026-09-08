import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CreditCard } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getPlatformSettings, listActiveSubscriptionPlansForRole } from '@/services/platformSettingsService'
import { openBillingPortal, subscribeToOwnSubscription, subscribeToPlan } from '@/services/subscriptionService'
import { subscribeSupportAllocations, updateSupportAllocations } from '@/services/supportService'
import { listFollowedArtistIds } from '@/services/followService'
import { getArtistProfile } from '@/services/artistService'
import { Button } from '@/components/common/Button'
import { MusicGlyph } from '@/components/common/MusicGlyph'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { PlatformSettings, SubscriptionPlan } from '@/types/platformSettings'
import type { SubscriptionDoc, SupportAllocationDoc } from '@/types/subscription'
import type { ArtistProfile } from '@/types/artist'

const FAN_FEATURE_LABELS: Record<string, string> = {
  supporterContent: 'Supporter-only posts and tracks',
  earlyAccess: 'Early access to new releases',
  polls: 'Take part in artist polls',
  artistDefinedPerks: 'Perks chosen by the artist',
}

function planHighlights(plan: SubscriptionPlan): string[] {
  const enabled = Object.entries(plan.features)
    .filter(([, value]) => value)
    .map(([key]) => FAN_FEATURE_LABELS[key] ?? key)

  if (plan.priceMinor === 0) return ['Discover independent artists', 'Follow artists and save music', 'Build your personal library']
  return enabled.length > 0 ? enabled : ['Direct a share to artists', 'Unlock supporter experiences', 'Cancel whenever you like']
}

export function SubscriptionPage() {
  const { firebaseUser } = useAuth()
  const [params] = useSearchParams()
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionDoc | null | undefined>(undefined)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null)

  useEffect(() => {
    void listActiveSubscriptionPlansForRole('fan').then(setPlans)
    void getPlatformSettings().then(setPlatformSettings)
  }, [])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeToOwnSubscription(firebaseUser.uid, setSubscription)
  }, [firebaseUser])

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const activePlan = plans?.find((p) => p.planId === subscription?.planId) ?? null

  async function handleSubscribe(planId: string) {
    setCheckoutLoading(planId)
    setCheckoutError(null)
    try {
      await subscribeToPlan(planId)
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
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
          {checkoutError ? <p className="text-sm text-danger-500">{checkoutError}</p> : null}

          {plans === null ? (
            <LoadingState />
          ) : plans.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-8 w-8 text-ink-3" />}
              title="No subscription plans configured yet"
              description="The platform admin hasn't published pricing yet. Check back soon."
            />
          ) : (
            <div className="grid items-stretch gap-3 lg:grid-cols-3">
              {plans.map((plan, index) => (
                <div
                  key={plan.planId}
                  className={`relative flex min-h-[27rem] flex-col overflow-hidden rounded-[1.75rem] border p-7 transition duration-300 hover:-translate-y-1 ${
                    plan.recommended
                      ? 'border-brand-400/35 bg-[radial-gradient(circle_at_80%_0%,rgba(200,243,63,.16),transparent_17rem),linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025))] shadow-[0_28px_80px_rgba(200,243,63,.08)]'
                      : 'border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015))]'
                  }`}
                >
                  <div className="absolute right-6 top-6 text-xs tabular-nums text-ink-3">0{index + 1}</div>
                  {plan.recommended ? (
                    <span className="mb-5 flex w-fit items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#090b06]"><MusicGlyph className="h-3.5 w-3.5" /> Recommended</span>
                  ) : (
                    <span className="mb-5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-ink-3">BackTheVibes plan</span>
                  )}
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink-0">{plan.name}</h2>
                  <p className="mt-4 text-4xl font-medium tracking-[-0.05em] text-ink-0">
                    {plan.priceMinor === 0 ? 'Free' : formatCurrency(plan.priceMinor, plan.currency)}
                    {plan.priceMinor > 0 ? <span className="ml-1 text-sm font-normal tracking-normal text-ink-2">/{plan.interval}</span> : null}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-ink-2">
                    {plan.priceMinor === 0 ? 'Start listening and build your world around independent music.' : 'Turn your subscription into meaningful support for artists.'}
                  </p>
                  <ul className="mt-7 space-y-3 border-t border-white/[0.08] pt-6">
                    {planHighlights(plan).slice(0, 4).map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm leading-5 text-ink-1">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-brand-400"><Check className="h-3 w-3" /></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-10">
                    <Button
                      className="w-full"
                      variant={plan.priceMinor === 0 ? 'secondary' : 'primary'}
                      disabled={plan.priceMinor === 0}
                      loading={checkoutLoading === plan.planId}
                      onClick={() => handleSubscribe(plan.planId)}
                    >
                      {plan.priceMinor === 0 ? 'Your current access' : `Choose ${plan.name}`}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {isActive && activePlan && platformSettings ? (
        <AllocationEditor
          fanId={firebaseUser!.uid}
          planCapMinor={Math.min(
            activePlan.limits?.supportAllocationCapMinor && activePlan.limits.supportAllocationCapMinor > 0
              ? activePlan.limits.supportAllocationCapMinor
              : activePlan.priceMinor,
            Math.round(activePlan.priceMinor * (platformSettings.artistAllocationPercent / 100)),
          )}
          currency={activePlan.currency}
        />
      ) : null}
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
      <h2 className="mb-1 text-lg font-semibold text-ink-0">Your artist support</h2>
      <p className="mb-4 text-sm leading-6 text-ink-2">
        {formatCurrency(planCapMinor, currency)} of your subscription — 80% of what you pay, after fees — is yours to
        direct to artists you follow. Split it however you like below; whatever you don't allocate stays with the
        platform. Once saved, this repeats automatically every billing cycle until you change it — no need to
        re-enter it each month.
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
          Allocated: {formatCurrency(totalMinor, currency)} of {formatCurrency(planCapMinor, currency)}
        </span>
        <span className={overCap ? 'text-danger-500' : 'text-ink-3'}>
          {overCap
            ? `${formatCurrency(totalMinor - planCapMinor, currency)} over budget`
            : `${formatCurrency(planCapMinor - totalMinor, currency)} remaining`}
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
