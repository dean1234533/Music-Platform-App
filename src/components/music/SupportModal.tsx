import { useState } from 'react'
import { Heart } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { startSupportPayment } from '@/services/supportService'
import { getPlatformSettings } from '@/services/platformSettingsService'
import { useEffect } from 'react'

const PRESET_AMOUNTS_MINOR = [500, 1000, 2000, 5000]

/**
 * The support amount picker. Clearly states, before payment, what the fan
 * is paying, BackTheVibes' platform fee, and what the artist receives —
 * never described as a "processing fee". Payment itself happens on Stripe's
 * own hosted Checkout page.
 */
export function SupportModal({ artistId, artistName, onClose }: { artistId: string; artistName: string; onClose: () => void }) {
  const [amountMinor, setAmountMinor] = useState(1000)
  const [customValue, setCustomValue] = useState('')
  const [platformFeePercent, setPlatformFeePercent] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getPlatformSettings().then((settings) => setPlatformFeePercent(settings?.platformFeePercent ?? null))
  }, [])

  function handlePresetClick(minor: number) {
    setAmountMinor(minor)
    setCustomValue('')
  }

  function handleCustomChange(value: string) {
    setCustomValue(value)
    const parsed = Math.round(Number(value) * 100)
    if (Number.isFinite(parsed) && parsed > 0) setAmountMinor(parsed)
  }

  async function handleContinue() {
    setLoading(true)
    setError(null)
    try {
      await startSupportPayment(artistId, amountMinor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
      setLoading(false)
    }
  }

  const feePercent = platformFeePercent ?? 20
  const platformFeeMinor = Math.round(amountMinor * (feePercent / 100))
  const artistNetMinor = amountMinor - platformFeeMinor

  return (
    <Modal title={`Support ${artistName}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <Heart className="h-4 w-4 text-support-400" /> A one-off payment, paid directly to {artistName} via Stripe.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {PRESET_AMOUNTS_MINOR.map((minor) => (
            <button
              key={minor}
              type="button"
              onClick={() => handlePresetClick(minor)}
              className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition ${
                amountMinor === minor && !customValue
                  ? 'border-support-500 bg-support-500/10 text-support-400'
                  : 'border-surface-border text-ink-1 hover:border-support-500/40'
              }`}
            >
              £{(minor / 100).toFixed(0)}
            </button>
          ))}
        </div>

        <div>
          <Label htmlFor="custom-amount">Or enter your own amount (GBP)</Label>
          <Input
            id="custom-amount"
            type="number"
            min="1"
            step="0.50"
            placeholder="£"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-2 p-3 text-xs leading-5 text-ink-2">
          <div className="flex items-center justify-between">
            <span>You pay</span>
            <span className="font-medium text-ink-0">£{(amountMinor / 100).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>BackTheVibes platform fee ({feePercent}%)</span>
            <span>£{(platformFeeMinor / 100).toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-surface-border pt-1 font-medium text-ink-0">
            <span>{artistName} receives</span>
            <span>£{(artistNetMinor / 100).toFixed(2)}</span>
          </div>
        </div>

        <p className="text-[11px] leading-4 text-ink-3">
          Payment is processed by Stripe. Refunds and disputes are handled through Stripe and our{' '}
          <a href="/legal/terms" className="underline">Terms</a>. This is a voluntary support payment, not a purchase of
          goods, services, or any rights to the artist's work.
        </p>

        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button onClick={handleContinue} loading={loading} disabled={amountMinor < 100} className="w-full">
          Continue to payment
        </Button>
      </div>
    </Modal>
  )
}
