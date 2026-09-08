import { useEffect, useState } from 'react'
import { Radar, Search, Users } from 'lucide-react'
import { listArtistsSeekingDJExposure, listMostSupportedArtists, listRisingArtists } from '@/services/discoveryService'
import { searchPlatform } from '@/services/searchService'
import type { DjTrackFilters } from '@/services/trackService'
import { TrackCard } from '@/components/music/TrackCard'
import { ArtistCard } from '@/components/music/ArtistCard'
import { Input } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { CAMELOT_KEYS, GENRES, MOODS } from '@/constants/musicTaxonomy'
import type { LicenceMode, TrackDoc } from '@/types/track'
import type { ArtistProfile } from '@/types/artist'

const LICENCE_OPTIONS: { value: LicenceMode; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'fixed_price', label: 'Fixed price' },
  { value: 'custom_price', label: 'Custom price' },
  { value: 'negotiated', label: 'Negotiated' },
]

type Tab = 'promoted' | 'artists'

export function DJDiscoverPage() {
  const [tab, setTab] = useState<Tab>('promoted')
  const [filters, setFilters] = useState<DjTrackFilters>({})
  const [tracks, setTracks] = useState<TrackDoc[] | null>(null)

  useEffect(() => {
    void listArtistsSeekingDJExposure(30, filters, true, true).then(setTracks)
  }, [filters])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">DJ Discovery</h1>
        <p className="mt-1 text-sm text-ink-2">
          {tab === 'promoted' ? 'Tracks artists have opened up for DJ promotion.' : 'Browse all artists on the platform, whether or not they have a DJ-promoted track.'}
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-full border border-surface-border bg-surface-1 p-1">
        <button
          type="button"
          onClick={() => setTab('promoted')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${tab === 'promoted' ? 'bg-surface-3 text-ink-0' : 'text-ink-2 hover:text-ink-0'}`}
        >
          <Radar className="h-4 w-4" /> DJ-promoted tracks
        </button>
        <button
          type="button"
          onClick={() => setTab('artists')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${tab === 'artists' ? 'bg-surface-3 text-ink-0' : 'text-ink-2 hover:text-ink-0'}`}
        >
          <Users className="h-4 w-4" /> Browse artists
        </button>
      </div>

      {tab === 'artists' ? (
        <ArtistBrowseTab />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-surface-border bg-surface-1 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <select
            value={filters.genre ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, genre: e.target.value || undefined }))}
            className="rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-brand-500"
          >
            <option value="">Any genre</option>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={filters.mood ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, mood: e.target.value || undefined }))}
            className="rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-brand-500"
          >
            <option value="">Any mood</option>
            {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={filters.key ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, key: e.target.value || undefined }))}
            className="rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-brand-500"
          >
            <option value="">Any key</option>
            {CAMELOT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select
            value={filters.licenceMode ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, licenceMode: (e.target.value || undefined) as LicenceMode | undefined }))}
            className="rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-brand-500"
          >
            <option value="">Any licence</option>
            {LICENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="number"
            placeholder="Min BPM"
            value={filters.bpmMin ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, bpmMin: e.target.value ? Number(e.target.value) : undefined }))}
            className="rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-brand-500"
          />
          <input
            type="number"
            placeholder="Max BPM"
            value={filters.bpmMax ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, bpmMax: e.target.value ? Number(e.target.value) : undefined }))}
            className="rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-brand-500"
          />
      </div>

      {tracks === null ? (
        <LoadingState />
      ) : tracks.length === 0 ? (
        <EmptyState icon={<Radar className="h-8 w-8 text-dj-400" />} title="No tracks match right now" />
      ) : (
        <div className="flex flex-wrap gap-4">
          {tracks.map((track) => (
            <TrackCard key={track.trackId} track={track} queue={tracks} />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}

function ArtistBrowseTab() {
  const [term, setTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ArtistProfile[] | null>(null)
  const [browseArtists, setBrowseArtists] = useState<ArtistProfile[] | null>(null)

  useEffect(() => {
    void Promise.all([listRisingArtists(24), listMostSupportedArtists(24)]).then(([rising, supported]) => {
      const merged = [...rising, ...supported].filter((a, i, arr) => arr.findIndex((b) => b.artistId === a.artistId) === i)
      setBrowseArtists(merged)
    })
  }, [])

  useEffect(() => {
    if (!term.trim()) {
      setSearchResults(null)
      return
    }
    let cancelled = false
    const timeout = setTimeout(() => {
      void searchPlatform(term).then((res) => {
        if (!cancelled) setSearchResults(res.artists)
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [term])

  const artists = searchResults ?? browseArtists

  return (
    <div className="flex flex-col gap-5">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search artists by name…" className="pl-9" />
      </div>

      {artists === null ? (
        <LoadingState />
      ) : artists.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8 text-dj-400" />} title={term.trim() ? `No artists match "${term}"` : 'No artists yet'} />
      ) : (
        <div className="flex flex-wrap gap-4">
          {artists.map((artist) => (
            <ArtistCard key={artist.artistId} artist={artist} />
          ))}
        </div>
      )}
    </div>
  )
}
