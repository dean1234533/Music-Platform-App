import { useEffect, useState } from 'react'
import {
  listArtistsSeekingDJExposure,
  listMostSupportedArtists,
  listNewReleaseTracks,
  listRisingArtists,
} from '@/services/discoveryService'
import { TrackCard } from '@/components/music/TrackCard'
import { ArtistCard } from '@/components/music/ArtistCard'
import { LoadingState, EmptyState } from '@/components/common/StateViews'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'

export function DiscoverPage() {
  const [loading, setLoading] = useState(true)
  const [newReleases, setNewReleases] = useState<TrackDoc[]>([])
  const [risingArtists, setRisingArtists] = useState<ArtistProfile[]>([])
  const [mostSupported, setMostSupported] = useState<ArtistProfile[]>([])
  const [djReady, setDjReady] = useState<TrackDoc[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [releases, rising, supported, dj] = await Promise.all([
        listNewReleaseTracks(24),
        listRisingArtists(12),
        listMostSupportedArtists(12),
        listArtistsSeekingDJExposure(12),
      ])
      if (cancelled) return
      setNewReleases(releases)
      setRisingArtists(rising)
      setMostSupported(supported)
      setDjReady(dj)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <LoadingState label="Loading discovery…" />

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Discover</h1>
        <p className="mt-1 text-sm text-ink-2">Real releases from real independent artists — no fabricated charts.</p>
      </div>

      <TrackSection title="New releases" tracks={newReleases} />
      <ArtistSection title="Rising artists" artists={risingArtists} emptyLabel="No artists have joined yet." />
      <ArtistSection
        title="Most supported artists"
        artists={mostSupported}
        emptyLabel="No artists have paying supporters yet."
      />
      <TrackSection
        title="Artists seeking DJ exposure"
        tracks={djReady}
        emptyLabel="No tracks are currently open for DJ promotion."
      />
    </div>
  )
}

function TrackSection({ title, tracks, emptyLabel }: { title: string; tracks: TrackDoc[]; emptyLabel?: string }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-ink-0">{title}</h2>
      {tracks.length === 0 ? (
        <EmptyState title={emptyLabel ?? 'Nothing here yet'} />
      ) : (
        <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
          {tracks.map((track) => (
            <TrackCard key={track.trackId} track={track} queue={tracks} />
          ))}
        </div>
      )}
    </div>
  )
}

function ArtistSection({ title, artists, emptyLabel }: { title: string; artists: ArtistProfile[]; emptyLabel?: string }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-ink-0">{title}</h2>
      {artists.length === 0 ? (
        <EmptyState title={emptyLabel ?? 'Nothing here yet'} />
      ) : (
        <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
          {artists.map((artist) => (
            <ArtistCard key={artist.artistId} artist={artist} />
          ))}
        </div>
      )}
    </div>
  )
}
