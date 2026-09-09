import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { counterOffer, sendOffer, type LicencePartyRole, type OfferTermsInput } from '@/services/licenceService'
import type { LicenceOfferDoc } from '@/types/licence'
import type { DjDealDoc } from '@/types/deal'

const EMPTY: OfferTermsInput = {
  priceMinor: 0,
  currency: 'gbp',
  permittedUse: '',
  territory: '',
  startDate: '',
  expiryDate: null,
  recordingPermission: true,
  streamingPermission: true,
  promotionalMixPermission: true,
  attributionRequirements: '',
  redistributionAllowed: false,
  resaleAllowed: false,
  remixAllowed: false,
  additionalTerms: '',
  offerExpiresAt: null,
}

/**
 * A DJ requesting a "starting from"/"negotiable"/"custom quote" deal still
 * requested *that specific deal* — the artist finalising terms should start
 * from what they already published, not retype it from a blank form (which
 * defeats the point of a reusable deal and risks accidentally granting
 * different terms than the deal actually promised).
 */
function fromDeal(deal: DjDealDoc): OfferTermsInput {
  const today = new Date().toISOString().slice(0, 10)
  const expiryDate = deal.durationDays
    ? new Date(new Date(`${today}T00:00:00.000Z`).getTime() + deal.durationDays * 86_400_000).toISOString().slice(0, 10)
    : null
  return {
    priceMinor: deal.priceMinor ?? 0,
    currency: deal.currency,
    permittedUse: deal.permittedUse,
    territory: deal.territory,
    startDate: today,
    expiryDate,
    recordingPermission: deal.recordingPermission,
    streamingPermission: deal.streamingPermission,
    promotionalMixPermission: deal.promotionalMixPermission,
    attributionRequirements: deal.attributionRequirements,
    redistributionAllowed: deal.redistributionAllowed,
    resaleAllowed: deal.resaleAllowed,
    remixAllowed: deal.remixAllowed,
    additionalTerms: deal.venueRestrictions ? `Venue restrictions: ${deal.venueRestrictions}${deal.additionalTerms ? `\n${deal.additionalTerms}` : ''}` : deal.additionalTerms,
  }
}

function fromOffer(offer: LicenceOfferDoc): OfferTermsInput {
  return {
    priceMinor: offer.priceMinor,
    currency: offer.currency,
    permittedUse: offer.permittedUse,
    territory: offer.territory,
    startDate: offer.startDate,
    expiryDate: offer.expiryDate,
    recordingPermission: offer.recordingPermission,
    streamingPermission: offer.streamingPermission,
    promotionalMixPermission: offer.promotionalMixPermission,
    attributionRequirements: offer.attributionRequirements,
    redistributionAllowed: offer.redistributionAllowed,
    resaleAllowed: offer.resaleAllowed,
    remixAllowed: offer.remixAllowed,
    additionalTerms: offer.additionalTerms,
  }
}

export function OfferFormModal({
  requestId,
  mode,
  previousOffer,
  sourceDeal = null,
  actingRole,
  onClose,
}: {
  requestId: string
  mode: 'send' | 'counter'
  previousOffer: LicenceOfferDoc | null
  /** The artist's published deal this request was made against, if any — pre-fills the form instead of starting blank. */
  sourceDeal?: DjDealDoc | null
  actingRole: LicencePartyRole
  onClose: () => void
}) {
  const initial = previousOffer ? fromOffer(previousOffer) : sourceDeal ? fromDeal(sourceDeal) : EMPTY
  const [terms, setTerms] = useState<OfferTermsInput>(initial)
  const [price, setPrice] = useState(String(initial.priceMinor / 100))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const input = { requestId, actingRole, ...terms, priceMinor: Math.round(Number(price || 0) * 100) }
      if (mode === 'send') await sendOffer(input)
      else await counterOffer(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this offer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={mode === 'send' ? 'Send offer' : 'Send counter-offer'} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        {sourceDeal && !previousOffer ? (
          <p className="rounded-lg border border-brand-400/25 bg-brand-500/5 px-3 py-2 text-xs text-ink-1">
            Pre-filled from your "{sourceDeal.name}" deal — review and adjust before sending.
          </p>
        ) : null}
        <div>
          <Label>Permitted use</Label>
          <Input value={terms.permittedUse} onChange={(e) => setTerms((t) => ({ ...t, permittedUse: e.target.value }))} placeholder="e.g. Non-commercial DJ sets" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Territory</Label>
            <Input value={terms.territory} onChange={(e) => setTerms((t) => ({ ...t, territory: e.target.value }))} placeholder="e.g. Worldwide" />
          </div>
          <div>
            <Label>Start date</Label>
            <Input type="date" value={terms.startDate} onChange={(e) => setTerms((t) => ({ ...t, startDate: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Expiry date (optional)</Label>
            <Input type="date" value={terms.expiryDate ?? ''} onChange={(e) => setTerms((t) => ({ ...t, expiryDate: e.target.value || null }))} />
          </div>
          <div>
            <Label>Price</Label>
            <div className="flex gap-2">
              <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              <select
                value={terms.currency}
                onChange={(e) => setTerms((t) => ({ ...t, currency: e.target.value }))}
                className="rounded-lg border border-surface-border bg-surface-2 px-2 text-sm text-ink-0"
              >
                <option value="gbp">GBP</option>
                <option value="usd">USD</option>
                <option value="eur">EUR</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <Label>Offer expires (optional)</Label>
          <Input
            type="date"
            value={terms.offerExpiresAt ?? ''}
            onChange={(e) => setTerms((t) => ({ ...t, offerExpiresAt: e.target.value || null }))}
          />
          <p className="mt-1 text-xs text-ink-3">
            If the other party hasn't accepted by this date, the offer expires automatically and can't be accepted — you can then send a fresh one.
          </p>
        </div>
        <div>
          <Label>Attribution requirements</Label>
          <Input
            value={terms.attributionRequirements}
            onChange={(e) => setTerms((t) => ({ ...t, attributionRequirements: e.target.value }))}
            placeholder="e.g. Credit artist name in set description"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Recording permitted" checked={terms.recordingPermission} onChange={(v) => setTerms((t) => ({ ...t, recordingPermission: v }))} />
          <Toggle label="Streaming permitted" checked={terms.streamingPermission} onChange={(v) => setTerms((t) => ({ ...t, streamingPermission: v }))} />
          <Toggle label="Promo mix permitted" checked={terms.promotionalMixPermission} onChange={(v) => setTerms((t) => ({ ...t, promotionalMixPermission: v }))} />
          <Toggle label="Redistribution allowed" checked={terms.redistributionAllowed} onChange={(v) => setTerms((t) => ({ ...t, redistributionAllowed: v }))} />
          <Toggle label="Resale allowed" checked={terms.resaleAllowed} onChange={(v) => setTerms((t) => ({ ...t, resaleAllowed: v }))} />
          <Toggle label="Remix allowed" checked={terms.remixAllowed} onChange={(v) => setTerms((t) => ({ ...t, remixAllowed: v }))} />
        </div>
        <div>
          <Label>Additional terms</Label>
          <TextArea rows={2} value={terms.additionalTerms} onChange={(e) => setTerms((t) => ({ ...t, additionalTerms: e.target.value }))} />
        </div>
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button onClick={handleSubmit} loading={submitting}>
          {mode === 'send' ? 'Send offer' : 'Send counter-offer'}
        </Button>
      </div>
    </Modal>
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
