import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { listLikedTrackIds } from '@/services/likeService'
import { getTrack } from '@/services/trackService'
import { TrackCard } from '@/components/music/TrackCard'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { TrackDoc } from '@/types/track'

export function LibraryPage() {
  const { firebaseUser } = useAuth()
  const [tracks, setTracks] = useState<TrackDoc[] | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    let cancelled = false
    async function load() {
      const ids = await listLikedTrackIds(firebaseUser!.uid)
      const fetched = await Promise.all(ids.map((id) => getTrack(id)))
      if (!cancelled) setTracks(fetched.filter((t): t is TrackDoc => t !== null))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [firebaseUser])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Library</h1>
      {tracks === null ? (
        <LoadingState />
      ) : tracks.length === 0 ? (
        <EmptyState
          title="No liked tracks yet"
          description="Tap the heart on any track to save it here."
          action={
            <Link to="/app/discover" className="text-sm font-medium text-brand-400 hover:underline">
              Discover music →
            </Link>
          }
        />
      ) : (
        <div className="flex flex-wrap gap-4">
          {tracks.map((track) => (
            <TrackCard key={track.trackId} track={track} queue={tracks} />
          ))}
        </div>
      )}
    </div>
  )
}
