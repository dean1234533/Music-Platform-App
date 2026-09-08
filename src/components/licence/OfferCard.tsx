import { useEffect, useState } from 'react'
import { Button } from '@/components/common/Button'
import { subscribeOffer, acceptOffer, withdrawOffer } from '@/services/licenceService'
import { formatCurrency } from '@/utils/format'
import type { LicenceOfferDoc } from '@/types/licence'

export function OfferCard({
  offerId,
  requestId,
  uid,
  onCounter,
}: {
  offerId: string
  requestId: string
  uid: string
  onCounter: (offer: LicenceOfferDoc) => void
}) {
  const [offer, setOffer] = useState<LicenceOfferDoc | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeOffer(offerId, setOffer), [offerId])

  if (!offer) return null

  const isOwnOffer = offer.createdBy === uid
  const canAct = offer.status === 'pending' && !isOwnOffer

  async function handleAccept() {
    setBusy(true)
    setError(null)
    try {
      await acceptOffer({ requestId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept this offer.')
    } finally {
      setBusy(false)
    }
  }

  async function handleWithdraw() {
    setBusy(true)
    try {
      await withdrawOffer({ requestId })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full rounded-xl border border-brand-400/30 bg-surface-2/70 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink-0">
          {offer.priceMinor > 0 ? formatCurrency(offer.priceMinor, offer.currency) : 'Free'} · v{offer.version}
        </p>
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink-2">{offer.status}</span>
      </div>
      <p className="mt-1 text-xs text-ink-2">
        {[offer.permittedUse, offer.territory, offer.startDate].filter(Boolean).join(' · ')}
      </p>
      {offer.additionalTerms ? <p className="mt-1 text-xs text-ink-2">{offer.additionalTerms}</p> : null}
      {error ? <p className="mt-2 text-xs text-danger-500">{error}</p> : null}
      {canAct ? (
        <div className="mt-2 flex gap-2">
          <Button size="sm" loading={busy} onClick={handleAccept}>
            Accept terms & create contract
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onCounter(offer)}>
            Counter
          </Button>
        </div>
      ) : isOwnOffer && offer.status === 'pending' ? (
        <div className="mt-2">
          <Button size="sm" variant="secondary" loading={busy} onClick={handleWithdraw}>
            Withdraw
          </Button>
        </div>
      ) : null}
    </div>
  )
}
