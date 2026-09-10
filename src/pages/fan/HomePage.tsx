import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { listFollowedArtistIds } from '@/services/followService'
import { listSupportedArtistIds } from '@/services/supportService'
import { listNewReleaseTracks } from '@/services/discoveryService'
import { subscribeActiveStoriesForArtists, subscribeMyViewedStoryIds } from '@/services/storyService'
import { TrackCard } from '@/components/music/TrackCard'
import { StoryRail } from '@/components/stories/StoryRail'
import { StoryViewer, type StoryGroup } from '@/components/stories/StoryViewer'
import { LoadingState, EmptyState } from '@/components/common/StateViews'
import type { TrackDoc } from '@/types/track'
import type { StoryDoc } from '@/types/story'

function useStoryRail(artistIds: string[], tiers: ('public' | 'followers' | 'supporters')[]) {
  const [byTier, setByTier] = useState<Record<string, StoryDoc[]>>({})
  useEffect(() => {
    const unsubs = tiers.map((tier) =>
      subscribeActiveStoriesForArtists(artistIds, tier, (stories) =>
        setByTier((prev) => ({ ...prev, [tier]: stories })),
      ),
    )
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistIds.join(','), tiers.join(',')])

  const byArtist = useMemo(() => {
    const map = new Map<string, StoryDoc[]>()
    for (const stories of Object.values(byTier)) {
      for (const s of stories) {
        map.set(s.artistId, [...(map.get(s.artistId) ?? []), s])
      }
    }
    // Preserve the caller's artist ordering (e.g. most-recently-followed first).
    const ordered = new Map<string, StoryDoc[]>()
    for (const id of artistIds) {
      if (map.has(id)) ordered.set(id, map.get(id)!)
    }
    return ordered
  }, [byTier, artistIds])

  return byArtist
}

export function HomePage() {
  const { firebaseUser, profile } = useAuth()
  const [followedIds, setFollowedIds] = useState<string[]>([])
  const [supportedIds, setSupportedIds] = useState<string[]>([])
  const [newReleases, setNewReleases] = useState<TrackDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set())
  const [viewerGroups, setViewerGroups] = useState<StoryGroup[] | null>(null)
  const [viewerInitialArtistId, setViewerInitialArtistId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [followed, supported, releases] = await Promise.all([
        firebaseUser ? listFollowedArtistIds(firebaseUser.uid) : Promise.resolve([]),
        firebaseUser ? listSupportedArtistIds(firebaseUser.uid) : Promise.resolve([]),
        listNewReleaseTracks(24),
      ])
      if (cancelled) return
      setFollowedIds(followed)
      setSupportedIds(supported)
      setNewReleases(releases)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeMyViewedStoryIds(firebaseUser.uid, setViewedStoryIds)
  }, [firebaseUser])

  const followedStoriesByArtist = useStoryRail(followedIds, ['public', 'followers'])
  const supportedStoriesByArtist = useStoryRail(supportedIds, ['public', 'supporters'])
  const storiesByArtist = useMemo(() => {
    const combined = new Map<string, StoryDoc[]>()
    const artistIds = [...new Set([...supportedIds, ...followedIds])]

    for (const artistId of artistIds) {
      const stories = [
        ...(supportedStoriesByArtist.get(artistId) ?? []),
        ...(followedStoriesByArtist.get(artistId) ?? []),
      ]
      const uniqueStories = [...new Map(stories.map((story) => [story.storyId, story])).values()]
      if (uniqueStories.length > 0) combined.set(artistId, uniqueStories)
    }

    return combined
  }, [supportedIds, followedIds, supportedStoriesByArtist, followedStoriesByArtist])

  function openRail(byArtist: Map<string, StoryDoc[]>, artistId: string) {
    const groups: StoryGroup[] = Array.from(byArtist.entries()).map(([id, stories]) => ({ artistId: id, stories }))
    setViewerGroups(groups)
    setViewerInitialArtistId(artistId)
  }

  if (loading) return <LoadingState label="Loading your feed…" />

  const fromFollowed = newReleases.filter((t) => followedIds.includes(t.artistId))
  const followedReleaseIds = new Set(fromFollowed.map((track) => track.trackId))
  const otherNewReleases = newReleases.filter((track) => !followedReleaseIds.has(track.trackId))
  const firstName = profile?.displayName?.split(' ')[0]

  return (
    <div className="flex flex-col gap-12">
      <div className="border-b border-white/[0.08] pb-8 pt-2">
        <p className="eyebrow">Your frequency</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.045em] text-ink-0 sm:text-5xl">{firstName ? `Good to have you back, ${firstName}.` : 'Good to have you back.'}</h1>
        <p className="mt-3 text-base text-ink-2">Fresh releases and familiar voices, selected around you.</p>
      </div>

      {storiesByArtist.size > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Stories from your artists</h2>
          <StoryRail
            groups={Array.from(storiesByArtist.entries()).map(([artistId, stories]) => ({
              artistId,
              hasUnseen: stories.some((s) => !viewedStoryIds.has(s.storyId)),
            }))}
            onOpen={(artistId) => openRail(storiesByArtist, artistId)}
          />
        </div>
      ) : null}

      {fromFollowed.length > 0 ? (
        <Section title="New from artists you follow" tracks={fromFollowed} />
      ) : followedIds.length === 0 ? (
        <EmptyState
          title="Follow artists to build your feed"
          description="Once you follow artists, their new releases show up here first."
          backgroundImage="/fan-follow-artists-bg.png"
          action={
            <Link to="/app/discover" className="text-sm font-medium text-brand-400 hover:underline">
              Discover artists →
            </Link>
          }
        />
      ) : null}

      {otherNewReleases.length > 0 || fromFollowed.length === 0 ? (
        <Section title="New releases" tracks={otherNewReleases} />
      ) : null}

      {viewerGroups && viewerInitialArtistId ? (
        <StoryViewer
          groups={viewerGroups}
          initialArtistId={viewerInitialArtistId}
          viewerUserId={firebaseUser?.uid ?? null}
          onClose={() => setViewerGroups(null)}
        />
      ) : null}
    </div>
  )
}

function Section({ title, tracks }: { title: string; tracks: TrackDoc[] }) {
  if (tracks.length === 0) {
    return (
      <div>
        <h2 className="mb-5 text-xl font-medium tracking-[-0.025em] text-ink-0">{title}</h2>
        <EmptyState title="Nothing here yet" description="Check back once artists start releasing music." />
      </div>
    )
  }
  return (
    <div>
      <h2 className="mb-5 text-xl font-medium tracking-[-0.025em] text-ink-0">{title}</h2>
      <div className="scrollbar-none flex gap-5 overflow-x-auto pb-5">
        {tracks.map((track) => (
          <TrackCard key={track.trackId} track={track} queue={tracks} />
        ))}
      </div>
    </div>
  )
}
