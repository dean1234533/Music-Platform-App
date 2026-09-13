import { Link, useLocation } from 'react-router-dom'
import { Pause, Play, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { usePlayer } from '@/contexts/PlayerContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { useAuth } from '@/contexts/AuthContext'
import { formatDuration } from '@/utils/format'
import { FollowButton } from '@/components/music/FollowButton'
import { SupportButton } from '@/components/music/SupportButton'
import { TrackActions } from '@/components/music/TrackActions'

export function PlayerBar() {
  const { currentTrack, isPlaying, isLoading, progressSec, durationSec, volume, accessGranted, attachContainer, togglePlay, seek, next, previous, closePlayer, setVolume } =
    usePlayer()
  const artist = useArtistSummary(currentTrack?.artistId ?? null)
  const { firebaseUser } = useAuth()
  const location = useLocation()

  if (!currentTrack) return null

  // Rendered globally now (not just inside AppShell), so it can't assume the dashboard's
  // sidebar/MobileNav are on screen — only offset around them when they actually are.
  const inDashboardShell = /^\/(app|dashboard|dj|admin)(\/|$)/.test(location.pathname)

  return (
    <div
      id="player-bar"
      className={`fixed inset-x-0 z-50 border-t border-white/[0.08] bg-[#090b0d]/95 px-3 py-2 shadow-[0_-20px_50px_rgba(0,0,0,.2)] backdrop-blur-2xl md:z-40 md:px-6 md:py-3 ${
        inDashboardShell
          ? 'bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 md:left-[264px]'
          : 'bottom-[env(safe-area-inset-bottom)]'
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2 md:hidden">
        <input
          type="range"
          min={0}
          max={durationSec || 30}
          value={progressSec}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 w-full cursor-pointer accent-brand-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Official YouTube player mount — this is the actual playback surface, not decoration. Never hidden behind a custom UI. */}
          <div className="relative h-11 w-20 shrink-0 overflow-hidden rounded-[10px] bg-black ring-1 ring-white/10 sm:h-14 sm:w-24">
            <div ref={attachContainer} className="h-full w-full" />
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-400 text-surface-0 shadow-lg transition hover:scale-105 hover:bg-brand-500 disabled:bg-brand-500 disabled:opacity-90"
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
            max={durationSec || 30}
            value={progressSec}
            onChange={(e) => seek(Number(e.target.value))}
            className="h-1 w-full cursor-pointer accent-brand-500"
          />
          <span className="w-10 shrink-0 text-xs tabular-nums text-ink-3">
            {formatDuration(durationSec)}
          </span>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Volume2 className="h-4 w-4 text-ink-3" />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
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
      {!isLoading && !accessGranted && artist && ['followers', 'supporters', 'early_access'].includes(currentTrack.visibility) ? (
        <div className="mt-2 flex flex-col gap-2 rounded-xl border border-brand-400/20 bg-brand-500/[0.07] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-ink-1">
            {currentTrack.visibility === 'followers'
              ? `Follow ${artist.name} for free to unlock this track.`
              : `Unlock this track by supporting ${artist.name}.`}
          </p>
          <div className="shrink-0">
            {currentTrack.visibility === 'followers'
              ? <FollowButton artistId={artist.artistId} size="sm" />
              : <SupportButton artistId={artist.artistId} size="sm" />}
          </div>
        </div>
      ) : (
        <p className="mt-1 text-center text-[11px] text-ink-3">Played via YouTube</p>
      )}
    </div>
  )
}
