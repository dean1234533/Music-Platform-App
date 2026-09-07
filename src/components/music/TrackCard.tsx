import { Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import type { TrackDoc } from '@/types/track'

export function TrackCard({ track, queue }: { track: TrackDoc; queue?: TrackDoc[] }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer()
  const artist = useArtistSummary(track.artistId)
  const isCurrent = currentTrack?.trackId === track.trackId

  return (
    <div className="group w-40 shrink-0 sm:w-48">
      <button
        type="button"
        onClick={() => playTrack(track, queue)}
        className="relative block aspect-square w-full overflow-hidden rounded-xl bg-surface-2"
      >
        {track.artworkURL ? (
          <img src={track.artworkURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-3">
            <Play className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg ${
              isCurrent && isPlaying ? 'opacity-100' : ''
            }`}
          >
            <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
          </span>
        </div>
      </button>
      <Link
        to={`/track/${track.trackId}`}
        className="mt-2 block truncate text-sm font-medium text-ink-0 hover:underline"
      >
        {track.title}
      </Link>
      {artist ? (
        <Link
          to={`/artist/${artist.slug}`}
          className="block truncate text-xs text-ink-2 hover:text-ink-1 hover:underline"
        >
          {artist.name}
        </Link>
      ) : (
        <div className="h-4" />
      )}
    </div>
  )
}
