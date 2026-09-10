import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createDjDeal, deleteDjDeal, newDealId, subscribeArtistDeals, updateDjDeal } from '@/services/dealService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { DealPriceType, DjDealDoc } from '@/types/deal'

const PRICE_TYPES: { value: DealPriceType; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'fixed', label: 'Fixed price' },
  { value: 'starting_from', label: 'Starting from' },
  { value: 'negotiable', label: 'Negotiable' },
  { value: 'custom_quote', label: 'Custom quote' },
]

const EMPTY_FORM = {
  name: '',
  description: '',
  priceType: 'free' as DealPriceType,
  price: '0',
  currency: 'gbp',
  permittedUse: '',
  territory: '',
  durationDays: '90',
  startRule: 'Immediately upon signing',
  expiryRule: 'Fixed duration from start date',
  venueRestrictions: '',
  recordingPermission: true,
  streamingPermission: true,
  promotionalMixPermission: true,
  attributionRequirements: '',
  redistributionAllowed: false,
  resaleAllowed: false,
  remixAllowed: false,
  additionalTerms: '',
}

export function DjDealsPage() {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const [deals, setDeals] = useState<DjDealDoc[] | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistDeals(firebaseUser.uid, setDeals)
  }, [firebaseUser])

  const needsPrice = form.priceType === 'fixed' || form.priceType === 'starting_from'

  async function handleCreate() {
    if (!firebaseUser || !form.name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createDjDeal(firebaseUser.uid, newDealId(), {
        name: form.name.trim(),
        description: form.description.trim(),
        priceType: form.priceType,
        priceMinor: needsPrice ? Math.round(Number(form.price || 0) * 100) : null,
        currency: form.currency,
        permittedUse: form.permittedUse.trim(),
        territory: form.territory.trim(),
        durationDays: form.durationDays ? Number(form.durationDays) : null,
        startRule: form.startRule.trim(),
        expiryRule: form.expiryRule.trim(),
        venueRestrictions: form.venueRestrictions.trim(),
        recordingPermission: form.recordingPermission,
        streamingPermission: form.streamingPermission,
        promotionalMixPermission: form.promotionalMixPermission,
        attributionRequirements: form.attributionRequirements.trim(),
        redistributionAllowed: form.redistributionAllowed,
        resaleAllowed: form.resaleAllowed,
        remixAllowed: form.remixAllowed,
        additionalTerms: form.additionalTerms.trim(),
      })
      setForm(EMPTY_FORM)
      notify(`"${form.name.trim()}" created — assign it to a track from Music to make it visible to DJs.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this deal.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">DJ Deals</h1>
        <p className="mt-1 text-sm text-ink-2">Create reusable licence terms, then assign them to specific tracks from Music.</p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-surface-border p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Deal name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard DJ Licence" />
          </div>
          <div>
            <Label>Price type</Label>
            <select
              value={form.priceType}
              onChange={(e) => setForm((f) => ({ ...f, priceType: e.target.value as DealPriceType }))}
              className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"
            >
              {PRICE_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <TextArea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>

        {needsPrice ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>{form.priceType === 'starting_from' ? 'Starting price' : 'Price'}</Label>
              <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
            <div>
              <Label>Currency</Label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"
              >
                <option value="gbp">GBP</option>
                <option value="usd">USD</option>
                <option value="eur">EUR</option>
              </select>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Permitted use</Label>
            <Input value={form.permittedUse} onChange={(e) => setForm((f) => ({ ...f, permittedUse: e.target.value }))} placeholder="e.g. Club + festival performance" />
          </div>
          <div>
            <Label>Territory</Label>
            <Input value={form.territory} onChange={(e) => setForm((f) => ({ ...f, territory: e.target.value }))} placeholder="e.g. UK, Worldwide" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Duration (days)</Label>
            <Input type="number" min={0} value={form.durationDays} onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))} />
          </div>
          <div>
            <Label>Start rule</Label>
            <Input value={form.startRule} onChange={(e) => setForm((f) => ({ ...f, startRule: e.target.value }))} />
          </div>
          <div>
            <Label>Expiry rule</Label>
            <Input value={form.expiryRule} onChange={(e) => setForm((f) => ({ ...f, expiryRule: e.target.value }))} />
          </div>
        </div>

        <div>
          <Label>Venue restrictions</Label>
          <Input value={form.venueRestrictions} onChange={(e) => setForm((f) => ({ ...f, venueRestrictions: e.target.value }))} placeholder="Optional" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Toggle label="Recording permitted" checked={form.recordingPermission} onChange={(v) => setForm((f) => ({ ...f, recordingPermission: v }))} />
          <Toggle label="Streaming permitted" checked={form.streamingPermission} onChange={(v) => setForm((f) => ({ ...f, streamingPermission: v }))} />
          <Toggle label="Promo mix permitted" checked={form.promotionalMixPermission} onChange={(v) => setForm((f) => ({ ...f, promotionalMixPermission: v }))} />
          <Toggle label="Redistribution allowed" checked={form.redistributionAllowed} onChange={(v) => setForm((f) => ({ ...f, redistributionAllowed: v }))} />
          <Toggle label="Resale allowed" checked={form.resaleAllowed} onChange={(v) => setForm((f) => ({ ...f, resaleAllowed: v }))} />
          <Toggle label="Remix allowed" checked={form.remixAllowed} onChange={(v) => setForm((f) => ({ ...f, remixAllowed: v }))} />
        </div>

        <div>
          <Label>Attribution requirements</Label>
          <Input value={form.attributionRequirements} onChange={(e) => setForm((f) => ({ ...f, attributionRequirements: e.target.value }))} placeholder="Optional" />
        </div>
        <div>
          <Label>Additional terms</Label>
          <TextArea rows={2} value={form.additionalTerms} onChange={(e) => setForm((f) => ({ ...f, additionalTerms: e.target.value }))} />
        </div>

        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button onClick={handleCreate} loading={submitting} disabled={!form.name.trim()} className="w-fit">
          Create deal
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Your deals</h2>
        {deals === null ? (
          <LoadingState />
        ) : deals.length === 0 ? (
          <EmptyState title="No deals yet" description="Create a reusable deal above, then assign it to tracks from Music." />
        ) : (
          <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
            {deals.map((deal) => (
              <div key={deal.dealId} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-0">{deal.name}</p>
                  <p className="text-xs text-ink-2">
                    {deal.priceType === 'free'
                      ? 'Free'
                      : deal.priceType === 'fixed'
                        ? formatCurrency(deal.priceMinor ?? 0, deal.currency)
                        : deal.priceType === 'starting_from'
                          ? `From ${formatCurrency(deal.priceMinor ?? 0, deal.currency)}`
                          : deal.priceType === 'negotiable'
                            ? 'Negotiable'
                            : 'Custom quote'}
                    {' · '}
                    {deal.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => updateDjDeal(deal.dealId, { active: !deal.active })}>
                  {deal.active ? 'Deactivate' : 'Activate'}
                </Button>
                <button onClick={() => deleteDjDeal(deal.dealId)} className="rounded-full p-2 text-ink-3 hover:text-danger-500" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-2 px-2.5 py-2 text-xs text-ink-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-brand-500" />
      {label}
    </label>
  )
}
