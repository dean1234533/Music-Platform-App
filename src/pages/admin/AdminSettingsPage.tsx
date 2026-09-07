import { useEffect, useState } from 'react'
import {
  adminBackfillEntitlements,
  adminSeedSubscriptionPlans,
  adminUpdatePlatformSettings,
  adminUpsertSubscriptionPlan,
  listAllSubscriptionPlans,
} from '@/services/adminService'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { formatCurrency } from '@/utils/format'
import type { SubscriptionPlan } from '@/types/platformSettings'
import { PLAN_ROLES, PLAN_TIERS, type PlanFeatureKey, type PlanLimitKey, type PlanRole, type PlanTier } from '@/types/entitlements'

const FEATURE_KEYS_BY_ROLE: Record<PlanRole, PlanFeatureKey[]> = {
  fan: ['supporterContent', 'earlyAccess', 'polls', 'artistDefinedPerks'],
  artist: [
    'unlimitedTracks',
    'albumsEps',
    'scheduledReleases',
    'supporterOnlyTracks',
    'advancedAnalytics',
    'fixedCustomDjPricing',
    'teamAccess',
    'bulkDjOutreach',
    'privatePromoReleases',
    'releaseEmbargoes',
    'exportableAnalytics',
  ],
  dj: [
    'unlimitedDjRequests',
    'crates',
    'verifiedDjEligible',
    'advancedFiltering',
    'privatePromoPools',
    'advancedCrates',
    'professionalAnalytics',
    'priorityAccess',
  ],
}

const LIMIT_KEYS_BY_ROLE: Record<PlanRole, PlanLimitKey[]> = {
  fan: ['supportAllocationCapMinor'],
  artist: ['maxActiveTracks'],
  dj: ['djRequestsPerMonth'],
}

interface PlanFormState {
  planId: string
  name: string
  role: PlanRole
  tier: PlanTier
  price: string
  currency: string
  interval: 'month' | 'year'
  stripePriceId: string
  isDefaultFree: boolean
  recommended: boolean
  displayOrder: string
  features: Partial<Record<PlanFeatureKey, boolean>>
  limits: Partial<Record<PlanLimitKey, string>>
}

const EMPTY_FORM: PlanFormState = {
  planId: '',
  name: '',
  role: 'fan',
  tier: 'free',
  price: '',
  currency: 'gbp',
  interval: 'month',
  stripePriceId: '',
  isDefaultFree: false,
  recommended: false,
  displayOrder: '0',
  features: {},
  limits: {},
}

export function AdminSettingsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM)
  const [savingPlan, setSavingPlan] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [feeForm, setFeeForm] = useState({ platformFeePercent: '15', artistAllocationPercent: '85', djServiceFeePercent: '10', minimumPayoutMinor: '2000' })
  const [savingFees, setSavingFees] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    void listAllSubscriptionPlans().then((rows) => setPlans(rows.sort((a, b) => a.displayOrder - b.displayOrder)))
  }, [])

  async function refreshPlans() {
    const updated = await listAllSubscriptionPlans()
    setPlans(updated.sort((a, b) => a.displayOrder - b.displayOrder))
  }

  async function handleSavePlan() {
    setSavingPlan(true)
    setSaved(null)
    try {
      const priceMinor = Math.round(Number(form.price) * 100)
      const limits: Partial<Record<PlanLimitKey, number>> = {}
      for (const key of LIMIT_KEYS_BY_ROLE[form.role]) {
        const raw = form.limits[key]
        if (raw !== undefined && raw !== '') limits[key] = Number(raw)
      }

      await adminUpsertSubscriptionPlan({
        planId: form.planId || `${form.role}_${form.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: form.name,
        role: form.role,
        tier: form.tier,
        priceMinor,
        currency: form.currency,
        interval: form.interval,
        stripePriceId: priceMinor > 0 ? form.stripePriceId : null,
        active: true,
        isDefaultFree: form.isDefaultFree,
        features: form.features,
        limits,
        displayOrder: Number(form.displayOrder) || 0,
        recommended: form.recommended,
      })
      setSaved('Plan saved.')
      await refreshPlans()
      setForm(EMPTY_FORM)
    } finally {
      setSavingPlan(false)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    setSaved(null)
    try {
      const result = await adminSeedSubscriptionPlans()
      setSaved(`Seeded ${result.seeded.length} plan(s)${result.skipped.length ? `, skipped ${result.skipped.length} already present` : ''}.`)
      await refreshPlans()
    } finally {
      setSeeding(false)
    }
  }

  async function handleBackfill() {
    setBackfilling(true)
    setSaved(null)
    try {
      const result = await adminBackfillEntitlements()
      setSaved(
        `Re-synced ${result.artistsUpdated} artist(s) and ${result.djsUpdated} DJ(s)` +
          (result.errors.length ? ` — ${result.errors.length} error(s), first: ${result.errors[0]}` : '.'),
      )
    } finally {
      setBackfilling(false)
    }
  }

  async function handleSaveFees() {
    setSavingFees(true)
    setSaved(null)
    try {
      await adminUpdatePlatformSettings({
        platformFeePercent: Number(feeForm.platformFeePercent),
        artistAllocationPercent: Number(feeForm.artistAllocationPercent),
        djServiceFeePercent: Number(feeForm.djServiceFeePercent),
        minimumPayoutMinor: Math.round(Number(feeForm.minimumPayoutMinor)),
      })
      setSaved('Platform settings saved.')
    } finally {
      setSavingFees(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink-0">Plans & fees</h1>
      {saved ? <p className="text-sm text-support-400">{saved}</p> : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-0">Subscription plans</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleSeed} loading={seeding}>
              Seed default 9 plans
            </Button>
            <Button size="sm" variant="secondary" onClick={handleBackfill} loading={backfilling}>
              Re-sync existing artist/DJ limits
            </Button>
          </div>
        </div>
        <p className="mb-3 text-xs text-ink-3">
          Run "Seed" first if plans don't exist yet, then "Re-sync" to fix any artist/DJ profile
          created before entitlements were added (their track/request limits won't update on their
          own — new profiles do this automatically).
        </p>

        {PLAN_ROLES.map((role) => (
          <div key={role} className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{role}</h3>
            <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
              {plans.filter((p) => p.role === role).length === 0 ? (
                <p className="px-4 py-3 text-sm text-ink-3">No plans yet.</p>
              ) : (
                plans
                  .filter((p) => p.role === role)
                  .map((plan) => (
                    <div key={plan.planId} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-ink-0">
                        {plan.name}
                        {plan.recommended ? <span className="ml-2 text-xs text-brand-400">recommended</span> : null}
                        {plan.isDefaultFree ? <span className="ml-2 text-xs text-ink-3">default free</span> : null}
                      </span>
                      <span className="text-ink-2">
                        {formatCurrency(plan.priceMinor, plan.currency)}/{plan.interval} · {plan.tier} ·{' '}
                        {plan.active ? 'active' : 'inactive'}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-4 rounded-xl border border-surface-border bg-surface-1 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <Label>Role</Label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as PlanRole, features: {}, limits: {} }))}
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
              >
                {PLAN_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tier</Label>
              <select
                value={form.tier}
                onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as PlanTier }))}
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
              >
                {PLAN_TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Price</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
            <div>
              <Label>Interval</Label>
              <select
                value={form.interval}
                onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value as 'month' | 'year' }))}
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
              >
                <option value="month">month</option>
                <option value="year">year</option>
              </select>
            </div>
            <div>
              <Label>Display order</Label>
              <Input type="number" value={form.displayOrder} onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>{`Stripe price ID${Number(form.price) > 0 ? '' : ' (leave blank for free plans)'}`}</Label>
              <Input
                value={form.stripePriceId}
                onChange={(e) => setForm((f) => ({ ...f, stripePriceId: e.target.value }))}
                placeholder="price_..."
                disabled={!form.price || Number(form.price) === 0}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-ink-1">
              <input
                type="checkbox"
                checked={form.isDefaultFree}
                onChange={(e) => setForm((f) => ({ ...f, isDefaultFree: e.target.checked }))}
                className="h-4 w-4 accent-brand-500"
              />
              Default free plan for this role
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-1">
              <input
                type="checkbox"
                checked={form.recommended}
                onChange={(e) => setForm((f) => ({ ...f, recommended: e.target.checked }))}
                className="h-4 w-4 accent-brand-500"
              />
              Recommended plan
            </label>
          </div>

          <div>
            <Label>Features</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FEATURE_KEYS_BY_ROLE[form.role].map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-ink-1">
                  <input
                    type="checkbox"
                    checked={form.features[key] === true}
                    onChange={(e) => setForm((f) => ({ ...f, features: { ...f.features, [key]: e.target.checked } }))}
                    className="h-4 w-4 accent-brand-500"
                  />
                  {key}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Limits (use -1 for unlimited)</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {LIMIT_KEYS_BY_ROLE[form.role].map((key) => (
                <div key={key}>
                  <Label>{key}</Label>
                  <Input
                    type="number"
                    value={form.limits[key] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, limits: { ...f.limits, [key]: e.target.value } }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Button size="sm" onClick={handleSavePlan} loading={savingPlan} disabled={!form.name || !form.price}>
              Save plan
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Platform fees</h2>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-surface-border bg-surface-1 p-4 sm:grid-cols-4">
          <div>
            <Label>Platform fee %</Label>
            <Input type="number" value={feeForm.platformFeePercent} onChange={(e) => setFeeForm((f) => ({ ...f, platformFeePercent: e.target.value }))} />
          </div>
          <div>
            <Label>Artist allocation %</Label>
            <Input type="number" value={feeForm.artistAllocationPercent} onChange={(e) => setFeeForm((f) => ({ ...f, artistAllocationPercent: e.target.value }))} />
          </div>
          <div>
            <Label>DJ service fee %</Label>
            <Input type="number" value={feeForm.djServiceFeePercent} onChange={(e) => setFeeForm((f) => ({ ...f, djServiceFeePercent: e.target.value }))} />
          </div>
          <div>
            <Label>Min payout (minor units)</Label>
            <Input type="number" value={feeForm.minimumPayoutMinor} onChange={(e) => setFeeForm((f) => ({ ...f, minimumPayoutMinor: e.target.value }))} />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <Button size="sm" onClick={handleSaveFees} loading={savingFees}>
              Save platform settings
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
