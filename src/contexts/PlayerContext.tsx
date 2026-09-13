import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { FirebaseError } from 'firebase/app'
import { getTrackYoutubeInfo, recordTrackPlay } from '@/services/trackService'
import type { TrackDoc } from '@/types/track'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { setPlaybackActive } from '@/lib/playbackActivity'
import { loadYoutubeIframeApi } from '@/lib/youtubeIframeApi'

interface PlayerContextValue {
  currentTrack: TrackDoc | null
  queue: TrackDoc[]
  isPlaying: boolean
  isLoading: boolean
  progressSec: number
  durationSec: number
  volume: number
  /** Null until the entitlement check confirms this viewer may see the YouTube link — the server decided this, not the client. */
  accessGranted: boolean
  /** Attach the mounted DOM node the official YouTube player renders into (owned by PlayerBar). */
  attachContainer: (el: HTMLDivElement | null) => void
  playTrack: (track: TrackDoc, queue?: TrackDoc[]) => void
  togglePlay: () => void
  seek: (seconds: number) => void
  next: () => void
  previous: () => void
  closePlayer: () => void
  setVolume: (volume: number) => void
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const previewCapSecRef = useRef<number | null>(null)
  const previousUserIdRef = useRef<string | null>(null)
  const queueRef = useRef<TrackDoc[]>([])
  const currentTrackRef = useRef<TrackDoc | null>(null)
  const [currentTrack, setCurrentTrack] = useState<TrackDoc | null>(null)
  const [queue, setQueue] = useState<TrackDoc[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progressSec, setProgressSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [volume, setVolumeState] = useState(85)
  const [accessGranted, setAccessGranted] = useState(false)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    currentTrackRef.current = currentTrack
  }, [currentTrack])

  useEffect(() => {
    // Also counts as "active" while a track is still loading/access-checking, not only once
    // it reaches PLAYING — otherwise a service worker update landing in that brief window
    // reloads the page out from under the very click that just started it (user-reported: a
    // track "not playing" turned out to be the reload racing the click, most visible on a
    // public profile page where every play attempt has to round-trip an access check first).
    setPlaybackActive(isPlaying || isLoading)
    return () => setPlaybackActive(false)
  }, [isPlaying, isLoading])

  const stopProgressPolling = useCallback(() => {
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const destroyPlayer = useCallback(() => {
    stopProgressPolling()
    playerRef.current?.destroy()
    playerRef.current = null
  }, [stopProgressPolling])

  const resetState = useCallback(() => {
    destroyPlayer()
    setCurrentTrack(null)
    setQueue([])
    setIsPlaying(false)
    setIsLoading(false)
    setProgressSec(0)
    setDurationSec(0)
    setAccessGranted(false)
    previewCapSecRef.current = null
  }, [destroyPlayer])

  useEffect(() => {
    const previousUserId = previousUserIdRef.current
    const nextUserId = firebaseUser?.uid ?? null
    if (previousUserId && previousUserId !== nextUserId) resetState()
    previousUserIdRef.current = nextUserId
  }, [firebaseUser?.uid, resetState])

  useEffect(() => destroyPlayer, [destroyPlayer])

  const stepQueueRef = useRef<(direction: 1 | -1) => void>(() => {})

  const loadAndPlay = useCallback(async (track: TrackDoc) => {
    setIsLoading(true)
    setAccessGranted(false)
    stopProgressPolling()
    try {
      // getTrackYoutubeInfo is the only place the app ever discloses a
      // track's YouTube link to a viewer who isn't its owner/admin — the
      // same public/followers/supporters/dj_only/private ladder that used
      // to gate hosted audio now gates whether we reveal the video ID. A
      // locked-but-previewable track (followers/supporters/early_access)
      // still hands back the video ID, flagged previewOnly, so the visitor
      // gets a real short taste instead of nothing at all (user-reported:
      // "even thogh it is set to followers, on profile 30 sec or so
      // preveiw everyone should be able to listen").
      const { youtubeVideoId, previewOnly, previewSeconds } = await getTrackYoutubeInfo(track)
      setAccessGranted(!previewOnly)
      previewCapSecRef.current = previewOnly && previewSeconds ? previewSeconds : null
      const container = containerRef.current
      if (!container) throw new Error('Player is not ready yet.')

      const YT = await loadYoutubeIframeApi()
      destroyPlayer()

      await new Promise<void>((resolve, reject) => {
        playerRef.current = new YT.Player(container, {
          videoId: youtubeVideoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (event) => {
              event.target.setVolume(volume)
              // The user already deliberately pressed play in our UI —
              // starting the official player here is that same gesture,
              // never an autoplay the visitor didn't ask for.
              event.target.playVideo()
              resolve()
            },
            onError: () => reject(new Error('This video is unavailable on YouTube.')),
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                setIsPlaying(true)
                setDurationSec(event.target.getDuration() || 0)
                stopProgressPolling()
                progressIntervalRef.current = window.setInterval(() => {
                  const current = playerRef.current?.getCurrentTime() ?? 0
                  setProgressSec(current)
                  const cap = previewCapSecRef.current
                  if (cap !== null && current >= cap) {
                    playerRef.current?.pauseVideo()
                    stopProgressPolling()
                    notify('Preview ended — follow the artist to hear the full track.', 'info')
                  }
                }, 500)
              } else if (event.data === YT.PlayerState.PAUSED) {
                setIsPlaying(false)
                stopProgressPolling()
              } else if (event.data === YT.PlayerState.ENDED) {
                setIsPlaying(false)
                stopProgressPolling()
                void recordTrackPlay(track.trackId).catch(() => {})
                stepQueueRef.current(1)
              }
            },
          },
        })
      })

      void recordTrackPlay(track.trackId).catch(() => {
        // Best-effort analytics — playback should not fail if this errors.
      })
    } catch (error) {
      setIsPlaying(false)
      const message = error instanceof FirebaseError && error.code === 'functions/permission-denied'
        ? 'This track is not available to you yet.'
        : error instanceof Error ? error.message : 'This track is not available to play.'
      notify(message, 'error')
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destroyPlayer, notify, stopProgressPolling, volume])

  const playTrack = useCallback(
    (track: TrackDoc, nextQueue?: TrackDoc[]) => {
      setCurrentTrack(track)
      setQueue(nextQueue ?? [track])
      setProgressSec(0)
      setDurationSec(0)
      void loadAndPlay(track)
    },
    [loadAndPlay],
  )

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player || !currentTrack) return
    if (isPlaying) {
      player.pauseVideo()
    } else {
      player.playVideo()
    }
  }, [currentTrack, isPlaying])

  const seek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true)
    setProgressSec(seconds)
  }, [])

  const stepQueue = useCallback(
    (direction: 1 | -1) => {
      const current = currentTrackRef.current
      const currentQueue = queueRef.current
      if (!current || currentQueue.length === 0) return
      const index = currentQueue.findIndex((t) => t.trackId === current.trackId)
      const nextIndex = index + direction
      const nextTrack = currentQueue[nextIndex]
      if (!nextTrack) return
      setCurrentTrack(nextTrack)
      void loadAndPlay(nextTrack)
    },
    [loadAndPlay],
  )
  stepQueueRef.current = stepQueue

  const next = useCallback(() => stepQueue(1), [stepQueue])
  const previous = useCallback(() => stepQueue(-1), [stepQueue])

  const closePlayer = useCallback(() => resetState(), [resetState])

  const setVolume = useCallback((value: number) => {
    setVolumeState(value)
    playerRef.current?.setVolume(value)
  }, [])

  const attachContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el
  }, [])

  const value = useMemo<PlayerContextValue>(
    () => ({
      currentTrack,
      queue,
      isPlaying,
      isLoading,
      progressSec,
      durationSec,
      volume,
      accessGranted,
      attachContainer,
      playTrack,
      togglePlay,
      seek,
      next,
      previous,
      closePlayer,
      setVolume,
    }),
    [
      currentTrack,
      queue,
      isPlaying,
      isLoading,
      progressSec,
      durationSec,
      volume,
      accessGranted,
      attachContainer,
      playTrack,
      togglePlay,
      seek,
      next,
      previous,
      closePlayer,
      setVolume,
    ],
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
