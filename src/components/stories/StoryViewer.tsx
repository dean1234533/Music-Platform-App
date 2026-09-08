import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Heart } from 'lucide-react'
import { clsx } from 'clsx'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { followArtist } from '@/services/followService'
import {
  getStoryMediaUrl,
  reactToStory,
  recordStoryCtaClick,
  recordStoryView,
  unreactToStory,
  voteStoryPoll,
} from '@/services/storyService'
import type { StoryDoc } from '@/types/story'

export interface StoryGroup {
  artistId: string
  stories: StoryDoc[]
}

const TICK_MS = 50
const DEFAULT_TEXT_DURATION_SEC = 6

/**
 * Full-screen story player: one segmented progress bar per story in the
 * current artist's group, tap-right/left to navigate, hold to pause,
 * swipe down to close. Advances groups automatically once the current
 * artist's stories run out.
 */
export function StoryViewer({
  groups,
  initialArtistId,
  viewerUserId,
  onClose,
}: {
  groups: StoryGroup[]
  initialArtistId: string
  viewerUserId: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [groupIndex, setGroupIndex] = useState(() => Math.max(groups.findIndex((g) => g.artistId === initialArtistId), 0))
  const [storyIndex, setStoryIndex] = useState(0)
  const [progressMs, setProgressMs] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [reacted, setReacted] = useState(false)
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null)
  const seenRef = useRef(new Set<string>())
  const touchStartY = useRef<number | null>(null)
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null)

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const artist = useArtistSummary(group?.artistId ?? null)

  // Public-tier media is already directly playable via story.mediaUrl.
  // Every other tier is owner-only at Storage — fetch a fresh short-lived
  // signed URL for the story actually on screen, checked against the
  // viewer's current entitlement rather than trusting a stale stored URL.
  useEffect(() => {
    if (!story) return
    if (story.visibility === 'public') {
      setResolvedMediaUrl(story.mediaUrl)
      return
    }
    setResolvedMediaUrl(null)
    let cancelled = false
    void getStoryMediaUrl({ storyId: story.storyId })
      .then(({ url }) => {
        if (!cancelled) setResolvedMediaUrl(url)
      })
      .catch(() => {
        if (!cancelled) setResolvedMediaUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [story])
  const durationMs = useMemo(() => {
    if (!story) return DEFAULT_TEXT_DURATION_SEC * 1000
    return (story.durationSec || DEFAULT_TEXT_DURATION_SEC) * 1000
  }, [story])

  useEffect(() => {
    setProgressMs(0)
    setReacted(false)
    setVotedOptionId(null)
  }, [groupIndex, storyIndex])

  useEffect(() => {
    if (!story || !viewerUserId || seenRef.current.has(story.storyId)) return
    seenRef.current.add(story.storyId)
    void recordStoryView(story.storyId, viewerUserId)
  }, [story, viewerUserId])

  function goNext() {
    if (!group) return
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }

  function goPrev() {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex((i) => i - 1)
      setStoryIndex(prevGroup.stories.length - 1)
    }
  }

  useEffect(() => {
    if (isPaused || !story) return
    const interval = setInterval(() => {
      setProgressMs((prev) => {
        if (prev + TICK_MS >= durationMs) {
          goNext()
          return 0
        }
        return prev + TICK_MS
      })
    }, TICK_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, story, durationMs, groupIndex, storyIndex])

  if (!group || !story || !artist) return null

  async function handleCta() {
    if (!story?.ctaType || !artist) return
    void recordStoryCtaClick(story.storyId)
    if (story.ctaType === 'track' && story.ctaTargetId) {
      navigate(`/track/${story.ctaTargetId}`)
    } else if (story.ctaType === 'follow' && viewerUserId) {
      await followArtist(viewerUserId, group.artistId)
    } else if (story.ctaType === 'support') {
      navigate(`/artist/${artist.slug}`)
    }
  }

  async function toggleReaction() {
    if (!viewerUserId || !story) return
    if (reacted) {
      setReacted(false)
      await unreactToStory(story.storyId, viewerUserId)
    } else {
      setReacted(true)
      await reactToStory(story.storyId, viewerUserId, '❤️')
    }
  }

  async function handleVote(optionId: string) {
    if (!viewerUserId || votedOptionId || !story) return
    setVotedOptionId(optionId)
    await voteStoryPoll(story.storyId, viewerUserId, optionId)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onTouchStart={(e) => {
        touchStartY.current = e.touches[0].clientY
      }}
      onTouchMove={(e) => {
        if (touchStartY.current == null) return
        if (e.touches[0].clientY - touchStartY.current > 80) onClose()
      }}
      onTouchEnd={() => {
        touchStartY.current = null
      }}
    >
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-surface-0 sm:h-[92vh] sm:rounded-2xl">
        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-2">
          {group.stories.map((s, i) => (
            <div key={s.storyId} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-[width] duration-75 ease-linear"
                style={{
                  width: i < storyIndex ? '100%' : i === storyIndex ? `${(progressMs / durationMs) * 100}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 top-4 z-10 flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2">
            {artist.photoURL ? (
              <img src={artist.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-surface-3" />
            )}
            <span className="text-sm font-medium text-white">{artist.name}</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative flex flex-1 items-center justify-center bg-black"
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          onPointerLeave={() => setIsPaused(false)}
        >
          {(story.mediaKind === 'image' || story.mediaKind === 'video' || story.mediaKind === 'audio') && !resolvedMediaUrl ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          ) : story.mediaKind === 'image' && resolvedMediaUrl ? (
            <img src={resolvedMediaUrl} alt="" className="max-h-full max-w-full object-contain" />
          ) : story.mediaKind === 'video' && resolvedMediaUrl ? (
            <video src={resolvedMediaUrl} autoPlay muted playsInline className="max-h-full max-w-full object-contain" />
          ) : story.mediaKind === 'audio' && resolvedMediaUrl ? (
            <div className="flex w-full flex-col items-center gap-4 px-8">
              <p className="text-center text-lg font-medium text-white">{story.caption}</p>
              <audio src={resolvedMediaUrl} autoPlay controls className="w-full" />
            </div>
          ) : story.mediaKind === 'poll' ? (
            <div className="flex w-full flex-col gap-3 px-8">
              <p className="text-center text-lg font-medium text-white">{story.caption}</p>
              {story.pollOptions.map((opt) => {
                const count = story.pollVoteCounts[opt.id] ?? 0
                const total = Object.values(story.pollVoteCounts).reduce((a, b) => a + b, 0) || 1
                const pct = Math.round((count / total) * 100)
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleVote(opt.id)}
                    disabled={!!votedOptionId}
                    className={clsx(
                      'relative overflow-hidden rounded-xl border border-white/20 px-4 py-3 text-left text-sm text-white',
                      votedOptionId === opt.id && 'border-brand-500',
                    )}
                  >
                    {votedOptionId ? (
                      <div className="absolute inset-0 bg-white/10" style={{ width: `${pct}%` }} />
                    ) : null}
                    <span className="relative flex justify-between">
                      <span>{opt.label}</span>
                      {votedOptionId ? <span>{pct}%</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="px-8 text-center text-xl font-medium text-white">{story.caption}</p>
          )}

          <button
            aria-label="Previous"
            onClick={goPrev}
            className="absolute inset-y-0 left-0 w-1/3 cursor-default"
          />
          <button
            aria-label="Next"
            onClick={goNext}
            className="absolute inset-y-0 right-0 w-2/3 cursor-default"
          />
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          {story.mediaKind !== 'text' && story.caption ? (
            <p className="line-clamp-2 flex-1 text-sm text-ink-1">{story.caption}</p>
          ) : (
            <span className="flex-1" />
          )}
          <div className="flex items-center gap-2">
            {story.ctaType ? (
              <button
                onClick={handleCta}
                className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-[#080a05] hover:bg-brand-400"
              >
                {story.ctaType === 'track' ? 'Listen' : story.ctaType === 'follow' ? 'Follow' : 'Support'}
              </button>
            ) : null}
            {viewerUserId ? (
              <button
                onClick={toggleReaction}
                className={clsx('rounded-full p-2', reacted ? 'text-danger-500' : 'text-white/70 hover:text-white')}
              >
                <Heart className="h-5 w-5" fill={reacted ? 'currentColor' : 'none'} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
