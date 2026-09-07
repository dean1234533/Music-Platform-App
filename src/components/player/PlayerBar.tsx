import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { useAuth } from '@/contexts/AuthContext'
import { formatDuration } from '@/utils/format'
import { FollowButton } from '@/components/music/FollowButton'
import { likeTrack, subscribeIsLiked, unlikeTrack } from '@/services/likeService'
import { clsx } from 'clsx'

export function PlayerBar() {
  const { currentTrack, isPlaying, isLoading, progressSec, durationSec, volume, togglePlay, seek, next, previous, setVolume } =
    usePlayer()
  const artist = useArtistSummary(currentTrack?.artistId ?? null)
  const { firebaseUser } = useAuth()
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    if (!firebaseUser || !currentTrack) {
      setLiked(false)
      return
    }
    return subscribeIsLiked(firebaseUser.uid, currentTrack.trackId, setLiked)
  }, [firebaseUser, currentTrack])

  if (!currentTrack) return null

  async function toggleLike() {
    if (!firebaseUser || !currentTrack) return
    if (liked) {
      await unlikeTrack(firebaseUser.uid, currentTrack.trackId)
    } else {
      await likeTrack(firebaseUser.uid, currentTrack.trackId)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 border-t border-surface-border bg-surface-1/95 px-3 py-2 backdrop-blur md:bottom-0 md:left-64 md:px-6 md:py-3">
      <div className="mb-1.5 flex items-center gap-2 md:hidden">
        <input
          type="range"
          min={0}
          max={durationSec || currentTrack.previewDurationSec || 30}
          value={progressSec}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 w-full accent-brand-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-2">
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
          <button onClick={previous} className="rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink-0" aria-label="Previous">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60"
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
          <button onClick={next} className="rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink-0" aria-label="Next">
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
            className="h-1 w-full accent-brand-500"
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
          <button
            onClick={toggleLike}
            className="hidden shrink-0 rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink-0 sm:block"
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <Heart className={clsx('h-4 w-4', liked && 'fill-danger-500 text-danger-500')} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
