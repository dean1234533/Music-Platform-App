import { Link } from 'react-router-dom'
import { Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { useAuth } from '@/contexts/AuthContext'
import { formatDuration } from '@/utils/format'
import { FollowButton } from '@/components/music/FollowButton'
import { TrackActions } from '@/components/music/TrackActions'

export function PlayerBar() {
  const { currentTrack, isPlaying, isLoading, progressSec, durationSec, volume, togglePlay, seek, next, previous, closePlayer, setVolume } =
    usePlayer()
  const artist = useArtistSummary(currentTrack?.artistId ?? null)
  const { firebaseUser } = useAuth()

  if (!currentTrack) return null

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 border-t border-white/[0.08] bg-[#090b0d]/90 px-3 py-2 shadow-[0_-20px_50px_rgba(0,0,0,.2)] backdrop-blur-2xl md:bottom-0 md:left-[264px] md:px-6 md:py-3">
      <div className="mb-1.5 flex items-center gap-2 md:hidden">
        <input
          type="range"
          min={0}
          max={durationSec || currentTrack.previewDurationSec || 30}
          value={progressSec}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 w-full cursor-pointer accent-brand-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-surface-2 ring-1 ring-white/10">
            {currentTrack.artworkURL ? (
              <img src={currentTrack.artworkURL} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <Link to={`/track/${currentTrack.trackId}`} className="block truncate text-sm font-medium text-ink-0 hover:underline">
              {currentTrack.title}
            </Link>
            {artist ? (
              <Link to={`/artist/${artist.slug}`} className="block truncate text-xs text-ink-2 hover:underline">
                {artist.name}
              </Link>
            ) : null}
          </div>
          {artist ? (
            <div className="hidden shrink-0 lg:block">
              <FollowButton artistId={artist.artistId} size="sm" />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <button onClick={previous} className="rounded-full p-2 text-ink-2 transition hover:bg-white/[0.06] hover:text-ink-0" aria-label="Previous">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-0 text-surface-0 shadow-lg transition hover:scale-105 hover:bg-brand-400 disabled:opacity-60"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" fill="currentColor" />
            ) : (
              <Play className="h-4 w-4 translate-x-0.5" fill="currentColor" />
            )}
          </button>
          <button onClick={next} className="rounded-full p-2 text-ink-2 transition hover:bg-white/[0.06] hover:text-ink-0" aria-label="Next">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden flex-1 items-center gap-2 md:flex">
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-3">
            {formatDuration(progressSec)}
          </span>
          <input
            type="range"
            min={0}
            max={durationSec || currentTrack.previewDurationSec || 30}
            value={progressSec}
            onChange={(e) => seek(Number(e.target.value))}
            className="h-1 w-full cursor-pointer accent-brand-500"
          />
          <span className="w-10 shrink-0 text-xs tabular-nums text-ink-3">
            {formatDuration(durationSec || currentTrack.previewDurationSec)}
          </span>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Volume2 className="h-4 w-4 text-ink-3" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 w-20 accent-brand-500"
          />
        </div>

        {firebaseUser ? (
          <div className="hidden shrink-0 sm:block"><TrackActions track={currentTrack} /></div>
        ) : null}

        <button
          type="button"
          onClick={closePlayer}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-white/[0.08] hover:text-ink-0"
          aria-label="Close player"
          title="Close player"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
