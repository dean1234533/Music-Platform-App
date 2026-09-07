import { useEffect, useState } from 'react'
import { Radar } from 'lucide-react'
import { listArtistsSeekingDJExposure } from '@/services/discoveryService'
import { TrackCard } from '@/components/music/TrackCard'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { TrackDoc } from '@/types/track'

export function DJDiscoverPage() {
  const [tracks, setTracks] = useState<TrackDoc[] | null>(null)

  useEffect(() => {
    void listArtistsSeekingDJExposure(30).then(setTracks)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">DJ Discovery</h1>
        <p className="mt-1 text-sm text-ink-2">Tracks artists have opened up for DJ promotion.</p>
      </div>

      <p className="text-xs text-ink-3">
        Open a track and use "Request DJ access" to start a licence request. Filtering by BPM,
        mood, and territory is a planned improvement.
      </p>

      {tracks === null ? (
        <LoadingState />
      ) : tracks.length === 0 ? (
        <EmptyState icon={<Radar className="h-8 w-8 text-dj-400" />} title="No tracks open for DJ promotion yet" />
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
