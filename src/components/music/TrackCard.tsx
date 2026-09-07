import { Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { TrackActions } from '@/components/music/TrackActions'
import type { TrackDoc } from '@/types/track'

export function TrackCard({ track, queue }: { track: TrackDoc; queue?: TrackDoc[] }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer()
  const artist = useArtistSummary(track.artistId)
  const isCurrent = currentTrack?.trackId === track.trackId

  return (
    <div className="group w-44 shrink-0 sm:w-52">
      <button
        type="button"
        onClick={() => playTrack(track, queue)}
        className="relative block aspect-square w-full overflow-hidden rounded-[1.25rem] bg-surface-2 shadow-[0_18px_45px_rgba(0,0,0,.22)] ring-1 ring-white/[0.07] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_26px_65px_rgba(0,0,0,.4)]"
      >
        {track.artworkURL ? (
          <img src={track.artworkURL} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-3">
            <Play className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/65 via-transparent to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-surface-0 shadow-xl transition-transform hover:scale-105 ${
              isCurrent && isPlaying ? 'opacity-100' : ''
            }`}
          >
            <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
          </span>
        </div>
      </button>
      <Link
        to={`/track/${track.trackId}`}
        className="mt-3 block truncate text-[15px] font-semibold tracking-[-0.01em] text-ink-0 hover:text-brand-400"
      >
        {track.title}
      </Link>
      <div className="mt-1 flex items-center justify-between gap-2">
        {artist ? (
          <Link to={`/artist/${artist.slug}`} className="min-w-0 truncate text-[13px] text-ink-2 hover:text-ink-1">
            {artist.name}
          </Link>
        ) : (
          <div className="h-4" />
        )}
        <TrackActions track={track} />
      </div>
    </div>
  )
}
