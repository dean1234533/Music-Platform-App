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
import { getPreviewPlaybackURL, recordPreviewPlay } from '@/services/trackService'
import type { TrackDoc } from '@/types/track'

interface PlayerContextValue {
  currentTrack: TrackDoc | null
  queue: TrackDoc[]
  isPlaying: boolean
  isLoading: boolean
  progressSec: number
  durationSec: number
  volume: number
  playTrack: (track: TrackDoc, queue?: TrackDoc[]) => void
  togglePlay: () => void
  seek: (seconds: number) => void
  next: () => void
  previous: () => void
  setVolume: (volume: number) => void
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<TrackDoc[]>([])
  const currentTrackRef = useRef<TrackDoc | null>(null)
  const [currentTrack, setCurrentTrack] = useState<TrackDoc | null>(null)
  const [queue, setQueue] = useState<TrackDoc[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progressSec, setProgressSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const [volume, setVolumeState] = useState(0.85)

  useEffect(() => {
    const audio = new Audio()
    audio.volume = volume
    audioRef.current = audio

    const onTimeUpdate = () => setProgressSec(audio.currentTime)
    const onLoadedMetadata = () => setDurationSec(audio.duration || 0)
    const onEnded = () => {
      const current = currentTrackRef.current
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

  const loadAndPlay = useCallback(async (track: TrackDoc) => {
    const audio = audioRef.current
    if (!audio) return
    setIsLoading(true)
    try {
      const url = await getPreviewPlaybackURL(track)
      audio.src = url
      audio.currentTime = track.previewStartSec || 0
      await audio.play()
      setIsPlaying(true)
      void recordPreviewPlay(track.trackId).catch(() => {
        // Best-effort analytics — playback should not fail if this errors.
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

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
    } else {
      void audio.play()
      setIsPlaying(true)
    }
  }, [currentTrack, isPlaying])

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
      playTrack,
      togglePlay,
      seek,
      next,
      previous,
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
      playTrack,
      togglePlay,
      seek,
      next,
      previous,
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
