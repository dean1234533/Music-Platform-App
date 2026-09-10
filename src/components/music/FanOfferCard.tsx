import { Link } from 'react-router-dom'
import { CalendarDays, Check, Gift, Lock, Tag, Trash2 } from 'lucide-react'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { Button } from '@/components/common/Button'
import type { FanOfferDoc } from '@/types/fanOffer'

const KIND_LABELS: Record<FanOfferDoc['kind'], string> = {
  exclusive: 'Exclusive',
  early_access: 'Early access',
  discount: 'Discount',
  event: 'Event',
  merch: 'Merch',
  other: 'Special offer',
}

export function FanOfferCard({
  offer,
  claimed,
  pending,
  ownerView = false,
  /** True once we know the fan's own plan (not per-artist follow/support) doesn't include artistDefinedPerks. */
  locked = false,
  onClaim,
  onDelete,
}: {
  offer: FanOfferDoc
  claimed?: boolean
  pending?: boolean
  ownerView?: boolean
  locked?: boolean
  onClaim?: () => void
  onDelete?: () => void
}) {
  const artist = useArtistSummary(offer.artistId)
  const expires = offer.expiresAt?.toDate()

  return (
    <article className="relative overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-gradient-to-br from-white/[0.06] to-white/[0.018] p-5 shadow-[0_18px_50px_rgba(0,0,0,.18)]">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand-500/[0.08] blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/20 bg-brand-400/[0.08] px-2.5 py-1 text-xs font-semibold text-brand-400">
            <Tag size={13} /> {KIND_LABELS[offer.kind]}
          </span>
          <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-ink-2">
            {offer.audience === 'everyone' ? 'Everyone' : offer.audience === 'followers' ? 'Followers' : 'Supporters'}
          </span>
        </div>
        <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-ink-0">{offer.title}</h3>
        {artist && !ownerView ? <p className="mt-1 text-sm font-medium text-brand-400">From {artist.name}</p> : null}
        <p className="mt-3 text-sm leading-6 text-ink-1">{offer.description}</p>
        {expires ? (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-3">
            <CalendarDays size={14} /> Ends {expires.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        ) : null}
        {ownerView ? (
          <Button variant="danger" size="sm" className="mt-5" onClick={onDelete}><Trash2 size={15} /> Delete offer</Button>
        ) : locked && !claimed ? (
          <div className="mt-5">
            <Link
              to="/app/subscription"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-ink-1 hover:bg-white/[0.1]"
            >
              <Lock size={15} /> Upgrade to claim
            </Link>
            <p className="mt-2 text-xs text-ink-3">Artist perks like this one are a Supporter plan benefit.</p>
          </div>
        ) : (
          <div className="mt-5">
            <Button variant={claimed ? 'secondary' : 'primary'} size="sm" onClick={onClaim} loading={pending}>
              {claimed ? <><Trash2 size={15} /> Remove claim</> : <><Gift size={15} /> Claim offer</>}
            </Button>
            {claimed && offer.redemption ? (
              <div className="mt-3 rounded-xl border border-brand-400/15 bg-brand-400/[0.055] p-3 text-sm text-ink-1">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-brand-400"><Check size={14} /> How to redeem</p>
                {offer.redemption}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </article>
  )
}
