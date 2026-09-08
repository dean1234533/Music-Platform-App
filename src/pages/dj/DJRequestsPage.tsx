import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Handshake, MessageSquare, Radar } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeRequestsForDj } from '@/services/licenceService'
import { listArtistsSeekingDJExposure } from '@/services/discoveryService'
import { getTrack } from '@/services/trackService'
import { getDealsByIds } from '@/services/dealService'
import { subscribeDJProfile, updateDJProfile } from '@/services/djService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { TrackCard } from '@/components/music/TrackCard'
import { Button } from '@/components/common/Button'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import type { LicenceRequestDoc } from '@/types/licence'
import type { TrackDoc } from '@/types/track'
import type { DjDealDoc } from '@/types/deal'
import { formatCurrency } from '@/utils/format'

interface DealOpportunity {
  deal: DjDealDoc
  track: TrackDoc
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'New',
  artist_review: 'Under review',
  negotiating: 'In discussion',
  offer_sent: 'Offer received',
  counter_offer: 'Counter offer',
  agreement_ready: 'Awaiting agreement',
  awaiting_signatures: 'Awaiting signatures',
  awaiting_payment: 'Awaiting payment',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export function DJRequestsPage() {
  const { firebaseUser } = useAuth()
  const [requests, setRequests] = useState<LicenceRequestDoc[] | null>(null)
  const [requestError, setRequestError] = useState(false)
  const [openTracks, setOpenTracks] = useState<TrackDoc[] | null>(null)
  const [dealOpportunities, setDealOpportunities] = useState<DealOpportunity[] | null>(null)
  const [promoOptIn, setPromoOptIn] = useState<boolean | null>(null)
  const [enablingPromos, setEnablingPromos] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    setRequestError(false)
    return subscribeRequestsForDj(firebaseUser.uid, setRequests, () => {
      setRequestError(true)
      setRequests([])
    })
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeDJProfile(firebaseUser.uid, (profile) => setPromoOptIn(profile?.bulkOutreachOptIn ?? false))
  }, [firebaseUser])

  async function enableArtistPromos() {
    if (!firebaseUser) return
    setEnablingPromos(true)
    try {
      await updateDJProfile(firebaseUser.uid, { bulkOutreachOptIn: true })
      setPromoOptIn(true)
    } finally {
      setEnablingPromos(false)
    }
  }

  useEffect(() => {
    void listArtistsSeekingDJExposure(30, {}, true, true)
      .then(async (tracks) => {
        setOpenTracks(tracks.slice(0, 6))
        const dealIds = [...new Set(tracks.flatMap((track) => track.djDealSettings?.allowedDealIds ?? []))]
        const deals = await getDealsByIds(dealIds)
        const dealById = new Map(deals.filter((deal) => deal.active).map((deal) => [deal.dealId, deal]))
        setDealOpportunities(
          tracks.flatMap((track) =>
            (track.djDealSettings?.allowedDealIds ?? [])
              .map((dealId) => dealById.get(dealId))
              .filter((deal): deal is DjDealDoc => Boolean(deal))
              .map((deal) => ({ deal, track })),
          ),
        )
      })
      .catch(() => {
        setOpenTracks([])
        setDealOpportunities([])
      })
  }, [])

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-ink-0">My requests</h1>
          <p className="mt-1 text-sm text-ink-2">Track every DJ access request you have sent to an artist.</p>
        </div>

        {requestError ? (
          <ErrorState
            title="Requests could not be loaded"
            description="Your requests have not been lost. Refresh the page to reconnect."
          />
        ) : requests === null ? (
          <LoadingState label="Loading your requests…" />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8 text-dj-400" />}
            title="You haven’t sent a request yet"
            description="Choose a track below, open its page and select Request DJ access. The request will then appear here."
            action={(
              <Link
                to="/dj/discover"
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-dj-400 px-5 py-2.5 text-sm font-semibold text-surface-0 transition hover:bg-dj-300"
              >
                Browse all requestable tracks
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          />
        ) : (
          <div className="flex flex-col divide-y divide-surface-border overflow-hidden rounded-2xl border border-surface-border bg-surface-1">
            {requests.map((req) => (
              <RequestRow key={req.requestId} request={req} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dj-400">From artists</p>
          <h2 className="mt-1 text-xl font-semibold text-ink-0">DJ promos & deals</h2>
          <p className="mt-1 text-sm text-ink-2">Licence packages artists have attached to tracks for DJs.</p>
        </div>

        {promoOptIn === false ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-dj-500/30 bg-dj-500/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-0">Artist promo messages are turned off</p>
              <p className="mt-1 text-sm text-ink-2">Turn them on to receive new-track promos directly from artists in Notifications.</p>
            </div>
            <Button size="sm" onClick={() => void enableArtistPromos()} loading={enablingPromos} className="shrink-0">
              Turn on artist promos
            </Button>
          </div>
        ) : null}

        {dealOpportunities === null ? (
          <LoadingState label="Loading artist deals…" />
        ) : dealOpportunities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface-1/40 px-5 py-6">
            <div className="flex items-start gap-3">
              <Handshake className="mt-0.5 h-5 w-5 shrink-0 text-dj-400" />
              <div>
                <p className="text-sm font-semibold text-ink-0">No artist deal packages are live yet</p>
                <p className="mt-1 text-sm text-ink-2">When an artist assigns an active DJ deal to a track, it will appear here automatically.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dealOpportunities.map(({ deal, track }) => (
              <DealOpportunityCard key={`${track.trackId}-${deal.dealId}`} deal={deal} track={track} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dj-400">Open for DJs</p>
            <h2 className="mt-1 text-xl font-semibold text-ink-0">Tracks accepting requests</h2>
            <p className="mt-1 text-sm text-ink-2">Open a track to review its terms and send the artist a request.</p>
          </div>
          <Link to="/dj/discover" className="hidden items-center gap-1 text-sm font-medium text-dj-400 hover:text-dj-300 sm:flex">
            See all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {openTracks === null ? (
          <LoadingState label="Finding open tracks…" />
        ) : openTracks.length === 0 ? (
          <EmptyState
            icon={<Radar className="h-8 w-8 text-dj-400" />}
            title="No tracks are open right now"
            description="New licensing opportunities from artists will appear here."
          />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {openTracks.map((track) => (
              <TrackCard key={track.trackId} track={track} queue={openTracks} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function dealPriceLabel(deal: DjDealDoc): string {
  if (deal.priceType === 'free') return 'Free'
  if (deal.priceType === 'fixed') return formatCurrency(deal.priceMinor ?? 0, deal.currency)
  if (deal.priceType === 'starting_from') return `From ${formatCurrency(deal.priceMinor ?? 0, deal.currency)}`
  if (deal.priceType === 'negotiable') return 'Negotiable'
  return 'Custom quote'
}

function DealOpportunityCard({ deal, track }: { deal: DjDealDoc; track: TrackDoc }) {
  const artist = useArtistSummary(track.artistId)

  return (
    <Link
      to={`/track/${track.trackId}`}
      className="group flex min-w-0 items-center gap-4 rounded-2xl border border-surface-border bg-surface-1 p-4 transition hover:border-dj-500/40 hover:bg-surface-2"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-3">
        {track.artworkURL ? <img src={track.artworkURL} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-sm font-semibold text-ink-0">{deal.name}</p>
          <span className="shrink-0 text-xs font-semibold text-dj-400">{dealPriceLabel(deal)}</span>
        </div>
        <p className="mt-1 truncate text-xs text-ink-1">{track.title} · {artist?.name ?? 'Artist'}</p>
        <p className="mt-1 line-clamp-1 text-xs text-ink-3">{deal.description || deal.permittedUse}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-dj-400" />
    </Link>
  )
}

function RequestRow({ request }: { request: LicenceRequestDoc }) {
  const artist = useArtistSummary(request.artistId)
  const [trackTitle, setTrackTitle] = useState('Track request')

  useEffect(() => {
    let active = true
    void getTrack(request.trackId)
      .then((track) => {
        if (active && track) setTrackTitle(track.title)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [request.trackId])

  return (
    <Link to={`/requests/${request.requestId}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-surface-2">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink-0">{trackTitle}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-2">{artist?.name ?? 'Artist'}</span>
      </span>
      <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-1">{STATUS_LABEL[request.status] ?? request.status}</span>
    </Link>
  )
}
