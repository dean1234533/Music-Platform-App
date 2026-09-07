import { useEffect, useState } from 'react'
import { adminUpdatePlatformSettings, adminUpsertSubscriptionPlan, listAllSubscriptionPlans } from '@/services/adminService'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { formatCurrency } from '@/utils/format'
import type { SubscriptionPlan } from '@/types/platformSettings'

export function AdminSettingsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [form, setForm] = useState({ planId: '', name: '', price: '', currency: 'gbp', interval: 'month' as 'month' | 'year', stripePriceId: '' })
  const [savingPlan, setSavingPlan] = useState(false)
  const [feeForm, setFeeForm] = useState({ platformFeePercent: '15', artistAllocationPercent: '85', djServiceFeePercent: '10', minimumPayoutMinor: '2000' })
  const [savingFees, setSavingFees] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    void listAllSubscriptionPlans().then(setPlans)
  }, [])

  async function handleSavePlan() {
    setSavingPlan(true)
    setSaved(null)
    try {
      await adminUpsertSubscriptionPlan({
        planId: form.planId || form.name.toLowerCase().replace(/\s+/g, '-'),
        name: form.name,
        priceMinor: Math.round(Number(form.price) * 100),
        currency: form.currency,
        interval: form.interval,
        stripePriceId: form.stripePriceId,
        active: true,
      })
      setSaved('Plan saved.')
      const updated = await listAllSubscriptionPlans()
      setPlans(updated)
      setForm({ planId: '', name: '', price: '', currency: 'gbp', interval: 'month', stripePriceId: '' })
    } finally {
      setSavingPlan(false)
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
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Subscription plans</h2>
        <div className="mb-4 flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {plans.map((plan) => (
            <div key={plan.planId} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-ink-0">{plan.name}</span>
              <span className="text-ink-2">
                {formatCurrency(plan.priceMinor, plan.currency)}/{plan.interval} · {plan.active ? 'active' : 'inactive'}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-surface-border bg-surface-1 p-4 sm:grid-cols-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Price</Label>
            <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
          <div>
            <Label>Stripe price ID</Label>
            <Input value={form.stripePriceId} onChange={(e) => setForm((f) => ({ ...f, stripePriceId: e.target.value }))} placeholder="price_..." />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Button size="sm" onClick={handleSavePlan} loading={savingPlan} disabled={!form.name || !form.price || !form.stripePriceId}>
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
