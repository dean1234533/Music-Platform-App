import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Play, Pause, Radio, Flag, Scale, ArrowLeft } from 'lucide-react'
import { getTrackIdForSlug, isTrackAcceptingDjRequests, subscribeTrack } from '@/services/trackService'
import { getArtistIdForSlug } from '@/services/artistService'
import { recordTrackView } from '@/services/analyticsService'
import { subscribeIsFollowing } from '@/services/followService'
import { subscribeIsSupporting } from '@/services/supportService'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { useSmartBack } from '@/hooks/useSmartBack'
import { useAuth } from '@/contexts/AuthContext'
import { homeFallbackPath } from '@/lib/workspaceRoute'
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
import { describeTrackAccess, TRACK_ACCESS_LABEL } from '@/utils/trackAccess'
import type { TrackDoc } from '@/types/track'

export function TrackPage() {
  // Under /artist/:slug/track/:trackId this param is either the clean
  // trackSlug (new share links) or a raw trackId (older links already out
  // in the wild) — resolved below. Under the flat /track/:trackId route
  // (no slug in scope) it's always a literal trackId.
  const { trackId: rawParam, slug } = useParams<{ trackId: string; slug?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [resolvedTrackId, setResolvedTrackId] = useState<string | null | undefined>(undefined)
  const [track, setTrack] = useState<TrackDoc | null | undefined>(undefined)
  const { playTrack, currentTrack, isPlaying, playbackKind, togglePlay } = usePlayer()
  const artist = useArtistSummary(track?.artistId ?? null)
  const { firebaseUser, hasRole, profile } = useAuth()
  const goBack = useSmartBack(homeFallbackPath(profile))
  const [showDjRequest, setShowDjRequest] = useState(false)
  const [requestDealId, setRequestDealId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isSupporting, setIsSupporting] = useState(false)

  useEffect(() => {
    if (!firebaseUser || !track) {
      setIsFollowing(false)
      setIsSupporting(false)
      return
    }
    const unsub1 = subscribeIsFollowing(firebaseUser.uid, track.artistId, setIsFollowing)
    const unsub2 = subscribeIsSupporting(firebaseUser.uid, track.artistId, setIsSupporting)
    return () => {
      unsub1()
      unsub2()
    }
  }, [firebaseUser, track?.artistId])

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

  const hasRecordedView = useRef(false)
  useEffect(() => {
    if (!resolvedTrackId || hasRecordedView.current) return
    hasRecordedView.current = true
    void recordTrackView(resolvedTrackId, searchParams.get('ref'))
  }, [resolvedTrackId, searchParams])

  // Settle the address bar on the canonical /artist/:slug/track/:trackSlug
  // form once the artist resolves — covers both the flat /track/:trackId
  // link and an old artist slug from before a slug change (resolution
  // above already followed the redirect, so the page works either way;
  // this just keeps the URL itself current).
  useEffect(() => {
    if (!artist || !track) return
    const onFlatUrl = window.location.pathname === `/track/${track.trackId}`
    const onStaleSlug = slug !== undefined && slug !== artist.slug
    if (!onFlatUrl && !onStaleSlug) return
    const trackParam = track.trackSlug ?? track.trackId
    navigate(`/artist/${artist.slug}/track/${trackParam}`, { replace: true })
  }, [artist, track, slug, navigate])

  if (resolvedTrackId === null) return <EmptyState title="Track not found" />
  if (track === undefined && loadError) {
    return <ErrorState title="Something went wrong" description="Couldn't load this page. Try refreshing." />
  }
  if (track === undefined) return <LoadingState label="Loading track…" />
  if (track === null) return <EmptyState title="Track not found" />
  if (track.takenDown) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="This track is no longer available"
          description="The artist has taken this track down."
          action={
            artist ? (
              <Link to={`/artist/${artist.slug}`} className="text-sm font-medium text-brand-400 hover:underline">
                View {artist.name}'s profile →
              </Link>
            ) : null
          }
        />
      </div>
    )
  }

  const isCurrent = currentTrack?.trackId === track.trackId
  const acceptsDjRequests = isTrackAcceptingDjRequests(track)
  const streamingRestricted = track.restrictedCapabilities?.includes('streaming') ?? false
  const access = describeTrackAccess(track, {
    isOwner: firebaseUser?.uid === track.artistId,
    isAdmin: hasRole('admin'),
    isFollowing,
    isSupporting,
  })
  const previewUnavailable = !access.fullAccess && track.previewEnabled === false

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 overflow-x-hidden px-4 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <button onClick={goBack} className="flex w-fit items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0 active:opacity-60">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="h-48 w-48 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
          {track.artworkURL ? <img src={track.artworkURL} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex flex-col justify-end gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Track</p>
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink-2">
              {TRACK_ACCESS_LABEL[track.visibility]}
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-ink-0">{track.title}</h1>
          {artist ? (
            <Link to={`/artist/${artist.slug}`} className="text-sm text-ink-2 hover:underline">
              {artist.name}
            </Link>
          ) : null}
          {streamingRestricted ? <p className="text-xs font-medium text-danger-500">Streaming is temporarily restricted while this track is under review.</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => !streamingRestricted && !previewUnavailable && (isCurrent ? togglePlay() : playTrack(track))}
              disabled={streamingRestricted || previewUnavailable}
              className="flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-3"
            >
              {isCurrent && isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 translate-x-0.5" fill="currentColor" />}
              {isCurrent && isPlaying ? 'Playing' : isCurrent && playbackKind ? (playbackKind === 'stream' ? 'Play Full Track' : playbackKind === 'dj_preview' ? 'Play DJ Preview' : 'Play Preview') : access.playLabel}
            </button>
            {artist ? <FollowButton artistId={artist.artistId} /> : null}
            {artist ? <SupportButton artistId={artist.artistId} size="sm" /> : null}
            <TrackActions track={track} labels />
            {artist && !track.restrictedCapabilities?.includes('sharing') ? (
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
          {access.lockedMessage ? <p className="max-w-md text-sm leading-6 text-ink-2">{access.lockedMessage}</p> : null}
        </div>
      </div>

      {track.description ? <p className="text-sm leading-relaxed text-ink-1">{track.description}</p> : null}

      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Meta label="Genre" value={track.genre} />
        {track.bpm ? <Meta label="BPM" value={String(track.bpm)} /> : null}
        {track.mood ? <Meta label="Mood" value={track.mood} /> : null}
        <Meta label="Full track" value={track.durationFormatted || (track.durationSeconds ? formatDuration(track.durationSeconds) : 'Duration unavailable')} />
        <Meta label="Preview" value={track.previewEnabled === false ? 'Unavailable' : formatDuration(track.previewDurationSec)} />
        <Meta label="Your access" value={access.fullAccess ? 'Full Track' : track.previewEnabled === false ? 'Locked' : 'Preview'} />
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
          ) : hasRole('artist') ? (
            // Artist and DJ are mutually exclusive on one account — an
            // active artist can't add a DJ profile, so no dead-end link here.
            <span className="text-sm text-ink-3">DJ requests aren't available on an artist account.</span>
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
