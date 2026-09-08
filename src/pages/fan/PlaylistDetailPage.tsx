import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ListMusic, Play, Trash2 } from 'lucide-react'
import { deletePlaylist, getPlaylist, removeTrackFromPlaylist } from '@/services/playlistService'
import { getTrack } from '@/services/trackService'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { useToast } from '@/contexts/ToastContext'
import type { PlaylistDoc } from '@/types/playlist'
import type { TrackDoc } from '@/types/track'

export function PlaylistDetailPage() {
  const { playlistId } = useParams<{ playlistId: string }>()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState<PlaylistDoc | null>(null)
  const [tracks, setTracks] = useState<TrackDoc[]>([])
  const [loading, setLoading] = useState(true)
  const { playTrack } = usePlayer()
  const { notify } = useToast()

  useEffect(() => {
    if (!playlistId) return
    let cancelled = false
    async function load() {
      const found = await getPlaylist(playlistId!)
      if (cancelled) return
      setPlaylist(found)
      if (found) {
        const fetched = await Promise.all(found.trackIds.map((id) => getTrack(id)))
        if (!cancelled) setTracks(fetched.filter((t): t is TrackDoc => t !== null))
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [playlistId])

  if (loading) return <LoadingState />
  if (!playlist) return <EmptyState title="Playlist not found" />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/10 text-brand-400"><ListMusic size={28} /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3">Your playlist</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink-0">{playlist.title}</h1>
          <p className="mt-1 text-sm text-ink-2">{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} · plays continuously in this order</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tracks.length > 0 ? (
            <Button onClick={() => playTrack(tracks[0]!, tracks)}>
              <Play className="h-4 w-4" fill="currentColor" />
              Play all
            </Button>
          ) : null}
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!window.confirm(`Delete “${playlist.title}”? This cannot be undone.`)) return
              try {
                await deletePlaylist(playlist.playlistId)
                notify(`Deleted ${playlist.title}.`, 'info')
                navigate('/app/playlists')
              } catch {
                notify('Could not delete the playlist. Please try again.', 'error')
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete playlist
          </Button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState title="No tracks in this playlist yet" description="Add tracks from a track page." />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {tracks.map((track) => (
            <PlaylistRow
              key={track.trackId}
              track={track}
              onPlay={() => playTrack(track, tracks)}
              onRemove={async () => {
                try {
                  await removeTrackFromPlaylist(playlist.playlistId, track.trackId)
                  setTracks((prev) => prev.filter((t) => t.trackId !== track.trackId))
                  notify(`Removed “${track.title}” from ${playlist.title}.`, 'info')
                } catch {
                  notify('Could not remove this track. Please try again.', 'error')
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PlaylistRow({ track, onPlay, onRemove }: { track: TrackDoc; onPlay: () => void; onRemove: () => void }) {
  const artist = useArtistSummary(track.artistId)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button onClick={onPlay} className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-2 hover:bg-surface-3">
        {track.artworkURL ? <img src={track.artworkURL} alt="" className="h-full w-full object-cover" /> : null}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
          <Play className={`h-4 w-4 text-white transition ${track.artworkURL ? 'opacity-0 group-hover:opacity-100' : 'text-ink-1'}`} />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-0">{track.title}</p>
        <p className="truncate text-xs text-ink-2">{artist?.name ?? ''}</p>
      </div>
      <button onClick={onRemove} className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-danger-500" aria-label={`Remove ${track.title} from playlist`} title="Remove from playlist">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
