import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { listFollowedArtistIds } from '@/services/followService'
import { getArtistProfile } from '@/services/artistService'
import { ArtistCard } from '@/components/music/ArtistCard'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { ArtistProfile } from '@/types/artist'

export function FollowingPage() {
  const { firebaseUser } = useAuth()
  const [artists, setArtists] = useState<ArtistProfile[] | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    let cancelled = false
    async function load() {
      const ids = await listFollowedArtistIds(firebaseUser!.uid)
      const profiles = await Promise.all(ids.map((id) => getArtistProfile(id)))
      if (!cancelled) setArtists(profiles.filter((p): p is ArtistProfile => p !== null))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [firebaseUser])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Following</h1>
      {artists === null ? (
        <LoadingState />
      ) : artists.length === 0 ? (
        <EmptyState
          title="You're not following anyone yet"
          description="Follow artists to get their release updates for free."
          action={
            <Link to="/app/discover" className="text-sm font-medium text-brand-400 hover:underline">
              Discover artists →
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {artists.map((artist) => (
            <ArtistCard key={artist.artistId} artist={artist} />
          ))}
        </div>
      )}
    </div>
  )
}
