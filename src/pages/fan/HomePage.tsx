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
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1>
        <p className="mt-1 text-sm text-ink-2">Here's what's new from the artists you follow.</p>
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
        <h2 className="mb-3 text-lg font-semibold text-ink-0">{title}</h2>
        <EmptyState title="Nothing here yet" description="Check back once artists start releasing music." />
      </div>
    )
  }
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-ink-0">{title}</h2>
      <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
        {tracks.map((track) => (
          <TrackCard key={track.trackId} track={track} queue={tracks} />
        ))}
      </div>
    </div>
  )
}
