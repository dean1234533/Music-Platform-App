import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Play, Pause, Radio, Flag, Scale, ArrowLeft } from 'lucide-react'
import { getTrackIdForSlug, isTrackAcceptingDjRequests, subscribeTrack } from '@/services/trackService'
import { getArtistIdForSlug } from '@/services/artistService'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { useAuth } from '@/contexts/AuthContext'
import { FollowButton } from '@/components/music/FollowButton'
import { SupportButton } from '@/components/music/SupportButton'
import { TrackActions } from '@/components/music/TrackActions'
import { RequestDjAccessModal } from '@/components/track/RequestDjAccessModal'
import { ReportTrackModal } from '@/components/track/ReportTrackModal'
import { DealsPanel } from '@/components/licence/DealsPanel'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/common/Button'
import { ShareButton } from '@/components/common/ShareButton'
import { formatDuration } from '@/utils/format'
import { trackShareUrl } from '@/utils/shareLinks'
import type { TrackDoc } from '@/types/track'

export function TrackPage() {
  // Under /artist/:slug/track/:trackId this param is either the clean
  // trackSlug (new share links) or a raw trackId (older links already out
  // in the wild) — resolved below. Under the flat /track/:trackId route
  // (no slug in scope) it's always a literal trackId.
  const { trackId: rawParam, slug } = useParams<{ trackId: string; slug?: string }>()
  const navigate = useNavigate()
  const [resolvedTrackId, setResolvedTrackId] = useState<string | null | undefined>(undefined)
  const [track, setTrack] = useState<TrackDoc | null | undefined>(undefined)
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer()
  const artist = useArtistSummary(track?.artistId ?? null)
  const { firebaseUser, hasRole } = useAuth()
  const [showDjRequest, setShowDjRequest] = useState(false)
  const [requestDealId, setRequestDealId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setResolvedTrackId(undefined)
    async function resolve() {
      if (!rawParam) return
      if (!slug) {
        if (!cancelled) setResolvedTrackId(rawParam)
        return
      }
      const artistId = await getArtistIdForSlug(slug)
      if (cancelled) return
      if (!artistId) {
        setResolvedTrackId(null)
        return
      }
      const viaSlug = await getTrackIdForSlug(artistId, rawParam)
      if (!cancelled) setResolvedTrackId(viaSlug ?? rawParam)
    }
    void resolve()
    return () => {
      cancelled = true
    }
  }, [rawParam, slug])

  useEffect(() => {
    if (!resolvedTrackId) return
    return subscribeTrack(resolvedTrackId, setTrack, () => setLoadError(true))
  }, [resolvedTrackId])

  // Upgrade the flat /track/:trackId address bar to the canonical nested
  // /artist/:slug/track/:trackSlug form once the artist resolves — flat
  // links already out in the wild (and the OG worker) keep working either way.
  useEffect(() => {
    if (!artist || !track) return
    if (window.location.pathname === `/track/${track.trackId}`) {
      const dest = track.trackSlug
        ? `/artist/${artist.slug}/track/${track.trackSlug}`
        : `/artist/${artist.slug}/track/${track.trackId}`
      navigate(dest, { replace: true })
    }
  }, [artist, track, navigate])

  if (resolvedTrackId === null) return <EmptyState title="Track not found" />
  if (track === undefined && loadError) {
    return <ErrorState title="Something went wrong" description="Couldn't load this page. Try refreshing." />
  }
  if (track === undefined) return <LoadingState label="Loading track…" />
  if (track === null) return <EmptyState title="Track not found" />

  const isCurrent = currentTrack?.trackId === track.trackId
  const acceptsDjRequests = isTrackAcceptingDjRequests(track)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <button onClick={() => navigate(-1)} className="flex w-fit items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="h-48 w-48 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
          {track.artworkURL ? <img src={track.artworkURL} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex flex-col justify-end gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Track</p>
          <h1 className="text-3xl font-semibold text-ink-0">{track.title}</h1>
          {artist ? (
            <Link to={`/artist/${artist.slug}`} className="text-sm text-ink-2 hover:underline">
              {artist.name}
            </Link>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => (isCurrent ? togglePlay() : playTrack(track))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600"
            >
              {isCurrent && isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />}
            </button>
            {artist ? <FollowButton artistId={artist.artistId} /> : null}
            {artist ? <SupportButton artistId={artist.artistId} size="sm" /> : null}
            <TrackActions track={track} labels />
            {artist ? (
              <ShareButton
                url={trackShareUrl(artist.slug, track.trackSlug ?? track.trackId)}
                title={track.title}
                text={`Listen to "${track.title}" by ${artist.name} on BackTheVibes`}
              />
            ) : null}
            {acceptsDjRequests ? (
              <span className="flex items-center gap-1.5 rounded-full bg-dj-500/15 px-3 py-2 text-xs font-medium text-dj-400">
                <Radio className="h-3.5 w-3.5" />
                Open for DJ promotion
              </span>
            ) : null}
            {firebaseUser ? (
              <button
                onClick={() => setShowReport(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink-1"
              >
                <Flag className="h-3.5 w-3.5" />
                Report
              </button>
            ) : null}
            <Link
              to={`/copyright/report?trackId=${track.trackId}`}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink-1"
            >
              <Scale className="h-3.5 w-3.5" />
              Report copyright issue
            </Link>
          </div>
        </div>
      </div>

      {track.description ? <p className="text-sm leading-relaxed text-ink-1">{track.description}</p> : null}

      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Meta label="Genre" value={track.genre} />
        {track.bpm ? <Meta label="BPM" value={String(track.bpm)} /> : null}
        {track.mood ? <Meta label="Mood" value={track.mood} /> : null}
        <Meta label="Preview" value={formatDuration(track.previewDurationSec)} />
      </div>

      {(track.credits.songwriters.length > 0 || track.credits.producers.length > 0 || track.credits.featuredArtists.length > 0) && (
        <div className="flex flex-col gap-1 text-sm text-ink-2">
          {track.credits.songwriters.length > 0 && <p>Songwriters: {track.credits.songwriters.join(', ')}</p>}
          {track.credits.producers.length > 0 && <p>Producers: {track.credits.producers.join(', ')}</p>}
          {track.credits.featuredArtists.length > 0 && <p>Featuring: {track.credits.featuredArtists.join(', ')}</p>}
        </div>
      )}

      {acceptsDjRequests ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dj-500/30 bg-dj-500/5 px-4 py-3 text-sm text-ink-1 sm:flex-row sm:items-center sm:justify-between">
          <span>This artist is accepting DJ requests for this track.</span>
          {hasRole('dj') ? (
            <Button size="sm" onClick={() => setShowDjRequest(true)}>
              Request DJ access
            </Button>
          ) : (
            <Link to="/onboarding/add-role?role=dj" className="text-sm font-medium text-dj-400 hover:underline">
              Add a DJ profile to request access →
            </Link>
          )}
        </div>
      ) : hasRole('dj') ? (
        <div className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm text-ink-2">
          This artist hasn't opened this track up for DJ requests.
        </div>
      ) : null}

      {hasRole('dj') && track.djDealSettings?.acceptDjRequests ? (
        <DealsPanel
          dealSettings={track.djDealSettings}
          onSelectDeal={(dealId) => {
            setRequestDealId(dealId)
            setShowDjRequest(true)
          }}
          onCustomDeal={() => {
            setRequestDealId(null)
            setShowDjRequest(true)
          }}
        />
      ) : null}

      {showDjRequest ? (
        <RequestDjAccessModal
          trackId={track.trackId}
          dealId={requestDealId}
          onClose={() => {
            setShowDjRequest(false)
            setRequestDealId(null)
          }}
        />
      ) : null}
      {showReport ? <ReportTrackModal trackId={track.trackId} onClose={() => setShowReport(false)} /> : null}

    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-ink-0">{value}</p>
    </div>
  )
}
