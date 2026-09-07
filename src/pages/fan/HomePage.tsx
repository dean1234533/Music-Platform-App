import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { listFollowedArtistIds } from '@/services/followService'
import { listNewReleaseTracks } from '@/services/discoveryService'
import { TrackCard } from '@/components/music/TrackCard'
import { LoadingState, EmptyState } from '@/components/common/StateViews'
import type { TrackDoc } from '@/types/track'

export function HomePage() {
  const { firebaseUser, profile } = useAuth()
  const [followedIds, setFollowedIds] = useState<string[]>([])
  const [newReleases, setNewReleases] = useState<TrackDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [ids, releases] = await Promise.all([
        firebaseUser ? listFollowedArtistIds(firebaseUser.uid) : Promise.resolve([]),
        listNewReleaseTracks(24),
      ])
      if (cancelled) return
      setFollowedIds(ids)
      setNewReleases(releases)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [firebaseUser])

  if (loading) return <LoadingState label="Loading your feed…" />

  const fromFollowed = newReleases.filter((t) => followedIds.includes(t.artistId))
  const firstName = profile?.displayName?.split(' ')[0]

  return (
    <div className="flex flex-col gap-12">
      <div className="border-b border-white/[0.08] pb-8 pt-2">
        <p className="eyebrow">Your frequency</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.045em] text-ink-0 sm:text-5xl">{firstName ? `Good to have you back, ${firstName}.` : 'Good to have you back.'}</h1>
        <p className="mt-3 text-base text-ink-2">Fresh releases and familiar voices, selected around you.</p>
      </div>

      {fromFollowed.length > 0 ? (
        <Section title="New from artists you follow" tracks={fromFollowed} />
      ) : followedIds.length === 0 ? (
        <EmptyState
          title="Follow artists to build your feed"
          description="Once you follow artists, their new releases show up here first."
          action={
            <Link to="/app/discover" className="text-sm font-medium text-brand-400 hover:underline">
              Discover artists →
            </Link>
          }
        />
      ) : null}

      <Section title="New releases" tracks={newReleases} />
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
