import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistProfile, subscribeArtistTracks } from '@/services/artistService'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCount } from '@/utils/format'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'

export function OverviewPage() {
  const { firebaseUser } = useAuth()
  const [artist, setArtist] = useState<ArtistProfile | null>(null)
  const [tracks, setTracks] = useState<TrackDoc[]>([])

  useEffect(() => {
    if (!firebaseUser) return
    const unsubProfile = subscribeArtistProfile(firebaseUser.uid, setArtist)
    const unsubTracks = subscribeArtistTracks(firebaseUser.uid, setTracks)
    return () => {
      unsubProfile()
      unsubTracks()
    }
  }, [firebaseUser])

  if (!artist) return <LoadingState />

  const totalPreviewPlays = tracks.reduce((sum, t) => sum + t.playCount, 0)
  const topTracks = [...tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 5)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Overview</h1>
        <p className="mt-1 text-sm text-ink-2">/artist/{artist.slug}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Followers" value={formatCount(artist.followerCount)} />
        <StatCard label="Supporters" value={formatCount(artist.supporterCount)} />
        <StatCard label="Tracks" value={formatCount(tracks.length)} />
        <StatCard label="Preview plays" value={formatCount(totalPreviewPlays)} />
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm text-ink-1">
        See the Revenue tab for subscription income, DJ licence income, and payouts.
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Most popular tracks</h2>
        {topTracks.length === 0 ? (
          <EmptyState
            title="No tracks yet"
            description="Upload your first track to start building an audience."
            action={
              <Link to="/dashboard/artist/upload" className="text-sm font-medium text-brand-400 hover:underline">
                Upload a track →
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
            {topTracks.map((track) => (
              <div key={track.trackId} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-ink-0">{track.title}</span>
                <span className="text-xs text-ink-2">{formatCount(track.playCount)} plays</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-1 p-4">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink-0">{value}</p>
    </div>
  )
}
