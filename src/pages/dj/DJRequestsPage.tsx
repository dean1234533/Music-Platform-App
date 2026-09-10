import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Handshake, MessageSquare, Radar } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { dismissLicenceRequest, respondToLicenceRequest, submitLicenceRequest, subscribeRequestsForDj } from '@/services/licenceService'
import { listArtistsSeekingDJExposure } from '@/services/discoveryService'
import { getTrack } from '@/services/trackService'
import { getDealsByIds } from '@/services/dealService'
import { subscribeDJProfile, updateDJProfile } from '@/services/djService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { useToast } from '@/contexts/ToastContext'
import { TrackCard } from '@/components/music/TrackCard'
import { RequestDjAccessModal } from '@/components/track/RequestDjAccessModal'
import { Button } from '@/components/common/Button'
import { OfferCard } from '@/components/licence/OfferCard'
import { OfferFormModal } from '@/components/licence/OfferFormModal'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import type { LicenceOfferDoc, LicenceRequestDoc } from '@/types/licence'
import type { TrackDoc } from '@/types/track'
import type { DjDealDoc } from '@/types/deal'
import { formatCurrency } from '@/utils/format'

interface DealOpportunity {
  deal: DjDealDoc
  track: TrackDoc
}

interface RequestTarget {
  trackId: string
  dealId?: string
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
  approved: 'Active',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

const CLOSED_STATUSES = ['rejected', 'cancelled', 'expired']
const REQUEST_FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
] as const

export function DJRequestsPage() {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const [allRequests, setRequests] = useState<LicenceRequestDoc[] | null>(null)
  const [requestError, setRequestError] = useState(false)
  const [openTracks, setOpenTracks] = useState<TrackDoc[] | null>(null)
  const [dealOpportunities, setDealOpportunities] = useState<DealOpportunity[] | null>(null)
  const [promoOptIn, setPromoOptIn] = useState<boolean | null>(null)
  // A dj-role account can reach this page without a djProfiles doc existing yet (e.g. the role
  // was granted without ever completing DJ profile setup) — updateDJProfile would then fail
  // with permission-denied (the update rule requires the doc to already exist), so this is
  // tracked separately from promoOptIn's own true/false to show a real prompt instead of a
  // control that silently fails.
  const [hasDjProfile, setHasDjProfile] = useState<boolean | null>(null)
  const [enablingPromos, setEnablingPromos] = useState(false)
  const [requestTarget, setRequestTarget] = useState<RequestTarget | null>(null)
  const [acceptingDealId, setAcceptingDealId] = useState<string | null>(null)
  const [offerModal, setOfferModal] = useState<{ requestId: string; previousOffer: LicenceOfferDoc } | null>(null)
  const [requestFilter, setRequestFilter] = useState<(typeof REQUEST_FILTERS)[number]['key']>('open')

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
    return subscribeDJProfile(firebaseUser.uid, (profile) => {
      setHasDjProfile(profile !== null)
      setPromoOptIn(profile?.bulkOutreachOptIn ?? false)
    })
  }, [firebaseUser])

  async function enableArtistPromos() {
    if (!firebaseUser) return
    setEnablingPromos(true)
    try {
      await updateDJProfile(firebaseUser.uid, { bulkOutreachOptIn: true })
      setPromoOptIn(true)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not turn on artist promos.', 'error')
    } finally {
      setEnablingPromos(false)
    }
  }

  async function acceptArtistDeal(deal: DjDealDoc, track: TrackDoc) {
    setAcceptingDealId(deal.dealId)
    try {
      await submitLicenceRequest({
        trackId: track.trackId,
        dealId: deal.dealId,
        intendedUse: 'dj_set',
        territory: deal.territory,
        expectedDate: '',
        venue: '',
        message: `Accepted “${deal.name}”.`,
      })
      notify('Deal requested. The artist will review it before the contract is created.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not accept this deal.', 'error')
    } finally {
      setAcceptingDealId(null)
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

  const requests = allRequests?.filter((r) => !r.dismissedBy?.includes(firebaseUser?.uid ?? '')) ?? null

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
            description="Choose a track below and select Request access. The request will then appear here."
            backgroundImage="/dj-requests-empty-bg.png"
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
          <>
            <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-full border border-surface-border bg-surface-1 p-1">
              {REQUEST_FILTERS.map((filter) => {
                const count =
                  filter.key === 'all'
                    ? requests.length
                    : requests.filter((r) => CLOSED_STATUSES.includes(r.status) === (filter.key === 'closed')).length
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setRequestFilter(filter.key)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                      requestFilter === filter.key ? 'bg-surface-3 text-ink-0' : 'text-ink-2 hover:text-ink-0'
                    }`}
                  >
                    {filter.label} ({count})
                  </button>
                )
              })}
            </div>
            {(() => {
              const filtered = requests.filter((r) =>
                requestFilter === 'all' ? true : CLOSED_STATUSES.includes(r.status) === (requestFilter === 'closed'),
              )
              return filtered.length === 0 ? (
                <EmptyState title={`No ${requestFilter} requests`} />
              ) : (
                <div className="flex flex-col divide-y divide-surface-border overflow-hidden rounded-2xl border border-surface-border bg-surface-1">
                  {filtered.map((req) => (
                    <RequestRow
                      key={req.requestId}
                      request={req}
                      onCounter={(offer) => setOfferModal({ requestId: req.requestId, previousOffer: offer })}
                      onError={(message) => notify(message, 'error')}
                    />
                  ))}
                </div>
              )
            })()}
          </>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dj-400">From artists</p>
          <h2 className="mt-1 text-xl font-semibold text-ink-0">DJ promos & deals</h2>
          <p className="mt-1 text-sm text-ink-2">Licence packages artists have attached to tracks for DJs.</p>
        </div>

        {hasDjProfile === false ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-dj-500/30 bg-dj-500/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-0">Finish setting up your DJ profile</p>
              <p className="mt-1 text-sm text-ink-2">Artist promos, deals, and requests need a DJ profile first.</p>
            </div>
            <Link
              to="/dj/profile"
              className="inline-flex shrink-0 items-center rounded-full bg-dj-400 px-4 py-2 text-sm font-semibold text-surface-0 hover:bg-dj-300"
            >
              Complete DJ profile
            </Link>
          </div>
        ) : promoOptIn === false ? (
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
            {dealOpportunities.map(({ deal, track }) => {
              // The most recent matching request only — a DJ can request again after a prior
              // one for this exact deal+track closed (rejected/cancelled/expired), so an old
              // closed request must never mask a fresh one still in progress.
              const matches = requests?.filter((r) => r.dealId === deal.dealId && r.trackId === track.trackId) ?? []
              const activeRequest = matches.find((r) => !CLOSED_STATUSES.includes(r.status)) ?? matches[0] ?? null
              return (
                <DealOpportunityCard
                  key={`${track.trackId}-${deal.dealId}`}
                  deal={deal}
                  track={track}
                  request={activeRequest}
                  accepting={acceptingDealId === deal.dealId}
                  onAccept={() => void acceptArtistDeal(deal, track)}
                  onRequestTerms={() => setRequestTarget({ trackId: track.trackId, dealId: deal.dealId })}
                />
              )
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dj-400">Open for DJs</p>
            <h2 className="mt-1 text-xl font-semibold text-ink-0">Tracks accepting requests</h2>
            <p className="mt-1 text-sm text-ink-2">Send the artist a request directly—no deal package is required.</p>
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
              <div key={track.trackId} className="flex w-44 shrink-0 flex-col gap-3 sm:w-52">
                <TrackCard track={track} queue={openTracks} />
                <Button size="sm" onClick={() => setRequestTarget({ trackId: track.trackId })} className="w-full">
                  Request access
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {requestTarget ? (
        <RequestDjAccessModal
          trackId={requestTarget.trackId}
          dealId={requestTarget.dealId}
          onClose={() => setRequestTarget(null)}
        />
      ) : null}
      {offerModal ? (
        <OfferFormModal
          requestId={offerModal.requestId}
          mode="counter"
          previousOffer={offerModal.previousOffer}
          actingRole="dj"
          onClose={() => setOfferModal(null)}
        />
      ) : null}
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

function DealOpportunityCard({
  deal,
  track,
  request,
  accepting,
  onAccept,
  onRequestTerms,
}: {
  deal: DjDealDoc
  track: TrackDoc
  request: LicenceRequestDoc | null
  accepting: boolean
  onAccept: () => void
  onRequestTerms: () => void
}) {
  const artist = useArtistSummary(track.artistId)
  const canAcceptImmediately = deal.priceType === 'free' || deal.priceType === 'fixed'
  // A request existing isn't a permanent state — it moves through review, can be approved
  // into an active deal, or closed out (rejected/cancelled/expired), and the DJ needs a
  // different, accurate action at each point instead of a button stuck forever on "Awaiting
  // artist" (user-reported: "the request has been completed... but the deal now just says
  // awaiting artist with no way to do anything").
  const isClosed = request ? CLOSED_STATUSES.includes(request.status) : false
  const isApproved = request?.status === 'approved'

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-surface-border bg-surface-1 p-4 transition hover:border-dj-500/40">
      <div className="flex min-w-0 items-center gap-4">
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
      </div>
      {!request || isClosed ? (
        <>
          {isClosed ? (
            <p className="text-xs text-ink-3">Previous request was {STATUS_LABEL[request!.status]?.toLowerCase() ?? request!.status} — you can request again.</p>
          ) : null}
          <Button
            size="sm"
            onClick={canAcceptImmediately ? onAccept : onRequestTerms}
            loading={accepting}
            className="w-full"
          >
            {canAcceptImmediately ? 'Accept deal' : 'Request final terms'}
          </Button>
        </>
      ) : isApproved ? (
        <Link
          to={`/dj-requests/${request.requestId}?as=dj`}
          className="flex w-full items-center justify-center rounded-lg bg-support-500/15 px-3 py-2 text-sm font-medium text-support-400 hover:bg-support-500/20"
        >
          Deal active — view contract
        </Link>
      ) : (
        <Link
          to={`/dj-requests/${request.requestId}?as=dj`}
          className="flex w-full items-center justify-center rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-sm font-medium text-ink-1 hover:bg-surface-3"
        >
          {STATUS_LABEL[request.status] ?? 'View request'}
        </Link>
      )}
    </div>
  )
}

function RequestRow({
  request,
  onCounter,
  onError,
}: {
  request: LicenceRequestDoc
  onCounter: (offer: LicenceOfferDoc) => void
  onError: (message: string) => void
}) {
  const artist = useArtistSummary(request.artistId)
  const [trackTitle, setTrackTitle] = useState('Track request')
  const [cancelling, setCancelling] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const isClosed = ['rejected', 'cancelled', 'expired'].includes(request.status)

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

  async function cancelRequest() {
    setCancelling(true)
    try {
      await respondToLicenceRequest(request.requestId, 'cancel', 'dj')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not cancel this request.')
    } finally {
      setCancelling(false)
    }
  }

  async function deleteRequest() {
    setDismissing(true)
    try {
      await dismissLicenceRequest({ requestId: request.requestId })
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not remove this request.')
      setDismissing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink-0">{trackTitle}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-2">{artist?.name ?? 'Artist'}</span>
        </span>
        <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-1">{STATUS_LABEL[request.status] ?? request.status}</span>
      </div>
      <Link to={`/dj-requests/${request.requestId}?as=dj`} className="w-fit text-xs font-medium text-dj-400 hover:text-dj-300">
        View request details & activity
      </Link>
      {request.currentAgreementId ? (
        <Link
          to={`/agreements/${request.currentAgreementId}?as=dj`}
          className="inline-flex w-fit items-center rounded-full bg-dj-400 px-4 py-2 text-sm font-semibold text-surface-0 hover:bg-dj-300"
        >
          Review & sign contract
        </Link>
      ) : ['rejected', 'cancelled', 'expired'].includes(request.status) ? null : request.currentOfferId ? (
        <OfferCard offerId={request.currentOfferId} requestId={request.requestId} actingRole="dj" onCounter={onCounter} />
      ) : ['submitted', 'artist_review', 'negotiating'].includes(request.status) ? (
        <div>
          <p className="text-xs text-ink-2">Waiting for the artist to approve your request and set the contract terms.</p>
          <Button size="sm" variant="secondary" loading={cancelling} onClick={() => void cancelRequest()} className="mt-2">
            Cancel request
          </Button>
        </div>
      ) : null}
      {isClosed ? (
        <Button size="sm" variant="secondary" loading={dismissing} onClick={() => void deleteRequest()} className="w-fit">
          Delete
        </Button>
      ) : null}
    </div>
  )
}
