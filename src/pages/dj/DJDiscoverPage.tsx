import { useEffect, useState } from 'react'
import { Radar } from 'lucide-react'
import { listArtistsSeekingDJExposure } from '@/services/discoveryService'
import type { DjTrackFilters } from '@/services/trackService'
import { TrackCard } from '@/components/music/TrackCard'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import { useEntitlement } from '@/hooks/useEntitlements'
import { CAMELOT_KEYS, GENRES, MOODS } from '@/constants/musicTaxonomy'
import type { LicenceMode, TrackDoc } from '@/types/track'

const LICENCE_OPTIONS: { value: LicenceMode; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'fixed_price', label: 'Fixed price' },
  { value: 'custom_price', label: 'Custom price' },
  { value: 'negotiated', label: 'Negotiated' },
]

export function DJDiscoverPage() {
  const { hasFeature, status } = useEntitlement('dj')
  const [filters, setFilters] = useState<DjTrackFilters>({})
  const [tracks, setTracks] = useState<TrackDoc[] | null>(null)

  const canFilter = hasFeature('advancedFiltering')
  const canSeePrivatePools = hasFeature('privatePromoPools')

  useEffect(() => {
    if (status === 'loading') return
    void listArtistsSeekingDJExposure(30, canFilter ? filters : {}, canSeePrivatePools, true).then(setTracks)
  }, [filters, canFilter, canSeePrivatePools, status])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">DJ Discovery</h1>
        <p className="mt-1 text-sm text-ink-2">Tracks artists have opened up for DJ promotion.</p>
      </div>

      {canFilter ? (
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
      ) : (
        <UpgradePrompt
          role="dj"
          reason="Filter by BPM, key, genre, mood, and licence type."
          cta="Upgrade to DJ Pro"
        />
      )}

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
    </div>
  )
}
