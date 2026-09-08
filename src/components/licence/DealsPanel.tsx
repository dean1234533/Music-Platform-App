import { useEffect, useState } from 'react'
import { getDealsByIds } from '@/services/dealService'
import { formatCurrency } from '@/utils/format'
import type { DjDealDoc } from '@/types/deal'
import type { TrackDjDealSettings } from '@/types/deal'

function restrictionSummary(deal: DjDealDoc): string[] {
  const notes: string[] = []
  if (!deal.redistributionAllowed) notes.push('No redistribution')
  if (!deal.resaleAllowed) notes.push('No resale')
  if (!deal.remixAllowed) notes.push('No remix')
  if (!deal.recordingPermission) notes.push('No recording')
  return notes
}

function priceLabel(deal: DjDealDoc): string {
  switch (deal.priceType) {
    case 'free':
      return 'Free'
    case 'fixed':
      return formatCurrency(deal.priceMinor ?? 0, deal.currency)
    case 'starting_from':
      return `From ${formatCurrency(deal.priceMinor ?? 0, deal.currency)}`
    case 'negotiable':
      return 'Negotiable'
    case 'custom_quote':
      return 'Talk to artist'
  }
}

export function DealsPanel({
  dealSettings,
  onSelectDeal,
  onCustomDeal,
}: {
  dealSettings: TrackDjDealSettings
  onSelectDeal: (dealId: string) => void
  onCustomDeal: () => void
}) {
  const [deals, setDeals] = useState<DjDealDoc[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void getDealsByIds(dealSettings.allowedDealIds).then((rows) => {
      if (!cancelled) setDeals(rows.filter((d) => d.active))
    })
    return () => {
      cancelled = true
    }
  }, [dealSettings.allowedDealIds])

  if (deals === null) return null

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Licensing deals</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {deals.map((deal) => (
          <button
            key={deal.dealId}
            onClick={() => onSelectDeal(deal.dealId)}
            className="flex flex-col gap-1.5 rounded-xl border border-surface-border bg-surface-1 p-4 text-left hover:bg-surface-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-0">{deal.name}</p>
              <p className="text-sm font-semibold text-brand-400">{priceLabel(deal)}</p>
            </div>
            {deal.description ? <p className="text-xs text-ink-2">{deal.description}</p> : null}
            <p className="text-xs text-ink-3">
              {[deal.permittedUse, deal.territory, deal.durationDays ? `${deal.durationDays} days` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {restrictionSummary(deal).length > 0 ? (
              <p className="text-xs text-ink-3">{restrictionSummary(deal).join(' · ')}</p>
            ) : null}
          </button>
        ))}
        <button
          onClick={onCustomDeal}
          className="flex flex-col justify-center gap-1 rounded-xl border border-dashed border-surface-border bg-surface-1 p-4 text-left hover:bg-surface-2"
        >
          <p className="text-sm font-semibold text-ink-0">Custom deal</p>
          <p className="text-xs text-ink-2">Talk to the artist directly about your specific use case.</p>
        </button>
      </div>
    </div>
  )
}
