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
import { getDjPreviewPlaybackURL, getPreviewPlaybackURL, getStreamPlaybackURL, recordTrackPlay } from '@/services/trackService'
import type { TrackDoc } from '@/types/track'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { setPlaybackActive } from '@/lib/playbackActivity'

/** null while nothing has loaded yet; otherwise which derivative the currently-loaded track actually is. */
type PlaybackKind = 'preview' | 'dj_preview' | 'stream' | null

interface PlayerContextValue {
  currentTrack: TrackDoc | null
  queue: TrackDoc[]
  isPlaying: boolean
  isLoading: boolean
  progressSec: number
  durationSec: number
  volume: number
  /** Whether the currently loaded audio is the full stream or a preview — the server decided this, not the client. */
  playbackKind: PlaybackKind
  previewEnded: boolean
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
  const { firebaseUser, hasRole } = useAuth()
  const { notify } = useToast()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previousUserIdRef = useRef<string | null>(null)
  const queueRef = useRef<TrackDoc[]>([])
  const currentTrackRef = useRef<TrackDoc | null>(null)
  const playbackKindRef = useRef<PlaybackKind>(null)
  const [currentTrack, setCurrentTrack] = useState<TrackDoc | null>(null)
  const [queue, setQueue] = useState<TrackDoc[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progressSec, setProgressSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [volume, setVolumeState] = useState(0.85)
  const [playbackKind, setPlaybackKind] = useState<PlaybackKind>(null)
  const [previewEnded, setPreviewEnded] = useState(false)

  useEffect(() => {
    const audio = new Audio()
    audio.volume = volume
    audioRef.current = audio

    const onTimeUpdate = () => setProgressSec(audio.currentTime)
    const onLoadedMetadata = () => setDurationSec(audio.duration || 0)
    const onEnded = () => {
      const current = currentTrackRef.current
      const completedKind = playbackKindRef.current
      if (current && completedKind) {
        void recordTrackPlay(current.trackId, completedKind, 'completion').catch(() => {})
      }
      if (completedKind === 'preview' || completedKind === 'dj_preview') {
        setIsPlaying(false)
        setPreviewEnded(true)
        return
      }
      const currentQueue = queueRef.current
      const index = current ? currentQueue.findIndex((track) => track.trackId === current.trackId) : -1
      const nextTrack = currentQueue[index + 1]
      if (!nextTrack) {
        setIsPlaying(false)
        return
      }
      setCurrentTrack(nextTrack)
      void loadAndPlay(nextTrack)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    currentTrackRef.current = currentTrack
  }, [currentTrack])

  useEffect(() => {
    playbackKindRef.current = playbackKind
  }, [playbackKind])

  // Lets registerServiceWorker.ts (outside React, no access to this context)
  // know whether to defer its post-deploy reload rather than yanking one out
  // from under someone mid-playback.
  useEffect(() => {
    setPlaybackActive(isPlaying)
    return () => setPlaybackActive(false)
  }, [isPlaying])

  useEffect(() => {
    const previousUserId = previousUserIdRef.current
    const nextUserId = firebaseUser?.uid ?? null
    if (previousUserId && previousUserId !== nextUserId) {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      setCurrentTrack(null)
      setQueue([])
      setIsPlaying(false)
      setIsLoading(false)
      setProgressSec(0)
      setDurationSec(0)
      setPlaybackKind(null)
      setPreviewEnded(false)
    }
    previousUserIdRef.current = nextUserId
  }, [firebaseUser?.uid])

  const loadAndPlay = useCallback(async (track: TrackDoc) => {
    const audio = audioRef.current
    if (!audio) return
    setIsLoading(true)
    setPreviewEnded(false)
    try {
      // Always ask for the full stream first — the server (getTrackPlaybackUrl)
      // is the only thing that actually decides whether this listener is
      // entitled to it (owner/admin/public/follower/supporter/DJ). Falling
      // back to the preview on a permission-denied is what makes the
      // "everyone can hear the preview, only entitled listeners hear the
      // full track" ladder work without duplicating that entitlement logic
      // here — the client never guesses who's allowed to hear what.
      let kind: 'preview' | 'dj_preview' | 'stream' = 'stream'
      let url: string
      try {
        url = await getStreamPlaybackURL(track)
      } catch (streamError) {
        const denied = streamError instanceof FirebaseError && streamError.code === 'functions/permission-denied'
        if (!denied) throw streamError
        if (hasRole('dj') && track.djPreviewAudioPath) {
          try {
            kind = 'dj_preview'
            url = await getDjPreviewPlaybackURL(track)
          } catch {
            kind = 'preview'
            url = await getPreviewPlaybackURL(track)
          }
        } else {
          kind = 'preview'
          url = await getPreviewPlaybackURL(track)
        }
      }
      audio.src = url
      // A preview derivative already starts at the artist's selected source
      // timestamp. Seeking it again would skip that many seconds inside the
      // short derivative and can make the preview appear broken.
      audio.currentTime = 0
      await audio.play()
      setIsPlaying(true)
      setPlaybackKind(kind)
      void recordTrackPlay(track.trackId, kind).catch(() => {
        // Best-effort analytics — playback should not fail if this errors.
      })
    } catch (error) {
      setIsPlaying(false)
      setPlaybackKind(null)
      const message = error instanceof FirebaseError && error.code === 'functions/permission-denied'
        ? 'Preview is currently unavailable.'
        : error instanceof Error ? error.message : 'This track is not available to play.'
      notify(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [hasRole, notify])

  // A signed URL is intentionally short lived, but access can still change
  // while it is open. Re-check full streams periodically and whenever the
  // app returns to the foreground; if access was lost, reload through the
  // normal server gate (which safely falls back to the preview).
  useEffect(() => {
    if (!currentTrack || playbackKind !== 'stream') return
    const revalidate = async () => {
      try {
        await getStreamPlaybackURL(currentTrack)
      } catch (error) {
        if (error instanceof FirebaseError && error.code === 'functions/permission-denied') {
          await loadAndPlay(currentTrack)
        }
      }
    }
    const interval = window.setInterval(() => void revalidate(), 60_000)
    const onFocus = () => void revalidate()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void revalidate()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [currentTrack, playbackKind, loadAndPlay])

  const playTrack = useCallback(
    (track: TrackDoc, nextQueue?: TrackDoc[]) => {
      setCurrentTrack(track)
      setQueue(nextQueue ?? [track])
      void loadAndPlay(track)
    },
    [loadAndPlay],
  )

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else if (audio.ended) {
      void loadAndPlay(currentTrack)
    } else {
      void audio.play()
      setIsPlaying(true)
    }
  }, [currentTrack, isPlaying, loadAndPlay])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    setProgressSec(seconds)
  }, [])

  const stepQueue = useCallback(
    (direction: 1 | -1) => {
      if (!currentTrack || queue.length === 0) return
      const index = queue.findIndex((t) => t.trackId === currentTrack.trackId)
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= queue.length) return
      const nextTrack = queue[nextIndex]!
      setCurrentTrack(nextTrack)
      void loadAndPlay(nextTrack)
    },
    [currentTrack, queue, loadAndPlay],
  )

  const next = useCallback(() => stepQueue(1), [stepQueue])
  const previous = useCallback(() => stepQueue(-1), [stepQueue])

  const closePlayer = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    setCurrentTrack(null)
    setQueue([])
    setIsPlaying(false)
    setIsLoading(false)
    setProgressSec(0)
    setDurationSec(0)
    setPlaybackKind(null)
    setPreviewEnded(false)
  }, [])

  const setVolume = useCallback((value: number) => {
    setVolumeState(value)
    if (audioRef.current) audioRef.current.volume = value
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
      playbackKind,
      previewEnded,
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
      playbackKind,
      previewEnded,
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
