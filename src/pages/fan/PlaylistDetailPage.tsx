import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Play, Trash2 } from 'lucide-react'
import { deletePlaylist, getPlaylist, removeTrackFromPlaylist } from '@/services/playlistService'
import { getTrack } from '@/services/trackService'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { PlaylistDoc } from '@/types/playlist'
import type { TrackDoc } from '@/types/track'

export function PlaylistDetailPage() {
  const { playlistId } = useParams<{ playlistId: string }>()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState<PlaylistDoc | null>(null)
  const [tracks, setTracks] = useState<TrackDoc[]>([])
  const [loading, setLoading] = useState(true)
  const { playTrack } = usePlayer()

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-0">{playlist.title}</h1>
        <Button
          variant="danger"
          size="sm"
          onClick={async () => {
            await deletePlaylist(playlist.playlistId)
            navigate('/app/playlists')
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
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
                await removeTrackFromPlaylist(playlist.playlistId, track.trackId)
                setTracks((prev) => prev.filter((t) => t.trackId !== track.trackId))
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
      <button onClick={onPlay} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 hover:bg-surface-3">
        <Play className="h-4 w-4 text-ink-1" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-0">{track.title}</p>
        <p className="truncate text-xs text-ink-2">{artist?.name ?? ''}</p>
      </div>
      <button onClick={onRemove} className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-danger-500">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
