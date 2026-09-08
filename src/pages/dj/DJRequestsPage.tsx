import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MessageSquare, Radar } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeRequestsForDj } from '@/services/licenceService'
import { listArtistsSeekingDJExposure } from '@/services/discoveryService'
import { getTrack } from '@/services/trackService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { TrackCard } from '@/components/music/TrackCard'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import type { LicenceRequestDoc } from '@/types/licence'
import type { TrackDoc } from '@/types/track'

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

  useEffect(() => {
    if (!firebaseUser) return
    setRequestError(false)
    return subscribeRequestsForDj(firebaseUser.uid, setRequests, () => {
      setRequestError(true)
      setRequests([])
    })
  }, [firebaseUser])

  useEffect(() => {
    void listArtistsSeekingDJExposure(6, {}, true, true)
      .then(setOpenTracks)
      .catch(() => setOpenTracks([]))
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
