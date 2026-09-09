import { useEffect, useState } from 'react'
import { Button } from '@/components/common/Button'
import { subscribeOffer, acceptOffer, rejectOffer, withdrawOffer, type LicencePartyRole } from '@/services/licenceService'
import { formatCurrency } from '@/utils/format'
import type { LicenceOfferDoc } from '@/types/licence'

export function OfferCard({
  offerId,
  requestId,
  actingRole,
  onCounter,
  onSendNew,
}: {
  offerId: string
  requestId: string
  actingRole: LicencePartyRole
  onCounter: (offer: LicenceOfferDoc) => void
  /** Shown only once this offer has expired and belongs to the current user — lets the artist replace it with a fresh offer. */
  onSendNew?: () => void
}) {
  const [offer, setOffer] = useState<LicenceOfferDoc | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeOffer(offerId, setOffer), [offerId])

  if (!offer) return null

  const isOwnOffer = offer.createdByRole === actingRole
  const isExpired = offer.status === 'expired' || (offer.status === 'pending' && offer.offerExpiresAt != null && offer.offerExpiresAt.toMillis() < Date.now())
  const canAct = offer.status === 'pending' && !isOwnOffer && !isExpired

  async function handleAccept() {
    setBusy(true)
    setError(null)
    try {
      await acceptOffer({ requestId, actingRole })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept this offer.')
    } finally {
      setBusy(false)
    }
  }

  async function handleWithdraw() {
    setBusy(true)
    try {
      await withdrawOffer({ requestId, actingRole })
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    setBusy(true)
    setError(null)
    try {
      await rejectOffer({ requestId, actingRole })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline this offer.')
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
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink-2">{isExpired ? 'expired' : offer.status}</span>
      </div>
      <p className="mt-1 text-xs text-ink-2">
        {[offer.permittedUse, offer.territory, offer.startDate].filter(Boolean).join(' · ')}
      </p>
      {offer.additionalTerms ? <p className="mt-1 text-xs text-ink-2">{offer.additionalTerms}</p> : null}
      {isExpired ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-danger-500">
            Offer Expired.{offer.createdByRole === 'artist' && isOwnOffer ? '' : ' Ask the artist to send a new offer.'}
          </p>
          {offer.createdByRole === 'artist' && isOwnOffer && onSendNew ? (
            <Button size="sm" onClick={onSendNew}>
              Send new offer
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger-500">{error}</p> : null}
      {canAct ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" loading={busy} onClick={handleAccept}>
            Accept terms & create contract
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onCounter(offer)}>
            Counter
          </Button>
          <Button size="sm" variant="danger" loading={busy} onClick={() => void handleReject()}>
            Reject
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
