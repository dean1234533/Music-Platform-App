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
    <div className="flex flex-col gap-12">
      <div className="border-b border-white/[0.08] pb-8 pt-2">
        <p className="eyebrow">Beyond the algorithm</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.045em] text-ink-0 sm:text-5xl">Find your next obsession.</h1>
        <p className="mt-3 text-base text-ink-2">Independent releases, real momentum, no fabricated charts.</p>
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
      <h2 className="mb-5 text-xl font-medium tracking-[-0.025em] text-ink-0">{title}</h2>
      {tracks.length === 0 ? (
        <EmptyState title={emptyLabel ?? 'Nothing here yet'} />
      ) : (
        <div className="scrollbar-none flex gap-5 overflow-x-auto pb-5">
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
      <h2 className="mb-5 text-xl font-medium tracking-[-0.025em] text-ink-0">{title}</h2>
      {artists.length === 0 ? (
        <EmptyState title={emptyLabel ?? 'Nothing here yet'} />
      ) : (
        <div className="scrollbar-none flex gap-5 overflow-x-auto pb-5">
          {artists.map((artist) => (
            <ArtistCard key={artist.artistId} artist={artist} />
          ))}
        </div>
      )}
    </div>
  )
}
