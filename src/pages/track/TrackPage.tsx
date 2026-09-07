import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Play, Pause, Radio, Flag } from 'lucide-react'
import { subscribeTrack } from '@/services/trackService'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeOwnPlaylists, addTrackToPlaylist } from '@/services/playlistService'
import { FollowButton } from '@/components/music/FollowButton'
import { RequestDjAccessModal } from '@/components/track/RequestDjAccessModal'
import { ReportTrackModal } from '@/components/track/ReportTrackModal'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/common/Button'
import { formatDuration } from '@/utils/format'
import type { TrackDoc } from '@/types/track'
import type { PlaylistDoc } from '@/types/playlist'

export function TrackPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const [track, setTrack] = useState<TrackDoc | null | undefined>(undefined)
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer()
  const artist = useArtistSummary(track?.artistId ?? null)
  const { firebaseUser, hasRole } = useAuth()
  const [playlists, setPlaylists] = useState<PlaylistDoc[]>([])
  const [showDjRequest, setShowDjRequest] = useState(false)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    if (!trackId) return
    return subscribeTrack(trackId, setTrack)
  }, [trackId])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeOwnPlaylists(firebaseUser.uid, setPlaylists)
  }, [firebaseUser])

  if (track === undefined) return <LoadingState label="Loading track…" />
  if (track === null) return <EmptyState title="Track not found" />

  const isCurrent = currentTrack?.trackId === track.trackId

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
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
            {track.djPromotion ? (
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

      {track.djPromotion && track.djLicenceMode !== 'not_available' ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dj-500/30 bg-dj-500/5 px-4 py-3 text-sm text-ink-1 sm:flex-row sm:items-center sm:justify-between">
          <span>This track is open for DJ requests.</span>
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
      ) : null}

      {showDjRequest ? <RequestDjAccessModal trackId={track.trackId} onClose={() => setShowDjRequest(false)} /> : null}
      {showReport ? <ReportTrackModal trackId={track.trackId} onClose={() => setShowReport(false)} /> : null}

      {firebaseUser ? (
        <div>
          <p className="mb-2 text-sm font-medium text-ink-0">Add to playlist</p>
          {playlists.length === 0 ? (
            <p className="text-sm text-ink-2">Create a playlist first from your Library.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {playlists.map((playlist) => (
                <button
                  key={playlist.playlistId}
                  onClick={() => addTrackToPlaylist(playlist.playlistId, track.trackId)}
                  className="rounded-full border border-surface-border bg-surface-2 px-3 py-1.5 text-xs text-ink-1 hover:bg-surface-3"
                >
                  + {playlist.title}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
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
