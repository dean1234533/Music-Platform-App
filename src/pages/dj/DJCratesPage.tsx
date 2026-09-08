import { useEffect, useState } from 'react'
import { Layers, Plus, Search, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  addTrackToCrate,
  createCrate,
  deleteCrate,
  removeTrackFromCrate,
  subscribeOwnCrates,
  updateCrateDetails,
} from '@/services/crateService'
import { searchPlatform } from '@/services/searchService'
import { getTrack } from '@/services/trackService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { CrateDoc } from '@/types/crate'
import type { TrackDoc } from '@/types/track'

export function DJCratesPage() {
  const { firebaseUser } = useAuth()
  const [crates, setCrates] = useState<CrateDoc[] | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeOwnCrates(firebaseUser.uid, setCrates)
  }, [firebaseUser])

  async function handleCreate() {
    if (!firebaseUser || !newTitle.trim()) return
    setCreating(true)
    try {
      await createCrate(firebaseUser.uid, newTitle.trim())
      setNewTitle('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Crates</h1>
        <p className="mt-1 text-sm text-ink-2">Organize tracks you're considering or cleared to play into named sets.</p>
      </div>

      <div className="flex max-w-md gap-2">
        <Input
          placeholder="New crate name"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <Button onClick={handleCreate} loading={creating} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </div>

      {crates === null ? (
        <LoadingState />
      ) : crates.length === 0 ? (
        <EmptyState icon={<Layers className="h-8 w-8 text-ink-3" />} title="No crates yet" description="Create your first crate above." />
      ) : (
        <div className="flex flex-col gap-4">
          {crates.map((crate) => (
            <CrateCard key={crate.crateId} crate={crate} />
          ))}
        </div>
      )}
    </div>
  )
}

function CrateCard({ crate }: { crate: CrateDoc }) {
  const [tracks, setTracks] = useState<Record<string, TrackDoc | null>>({})

  useEffect(() => {
    let cancelled = false
    const missing = crate.trackIds.filter((id) => !(id in tracks))
    if (missing.length === 0) return
    void Promise.all(missing.map((id) => getTrack(id).then((t) => [id, t] as const))).then((entries) => {
      if (!cancelled) setTracks((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crate.trackIds])

  return (
    <div className="rounded-xl border border-surface-border bg-surface-1 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-0">{crate.title}</p>
        <button
          type="button"
          onClick={() => deleteCrate(crate.crateId)}
          className="text-xs text-ink-3 transition hover:text-danger-500"
        >
          Delete crate
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {crate.trackIds.length === 0 ? (
          <li className="text-xs text-ink-3">No tracks yet — search below to add one.</li>
        ) : (
          crate.trackIds.map((trackId) => {
            const track = tracks[trackId]
            return (
              <li key={trackId} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-ink-1">
                <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-surface-3">
                  {track?.artworkURL ? <img src={track.artworkURL} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <span className="min-w-0 flex-1 truncate">{track ? track.title : track === null ? 'Track no longer available' : 'Loading…'}</span>
                <button type="button" onClick={() => removeTrackFromCrate(crate.crateId, trackId)} aria-label="Remove from crate">
                  <X className="h-3.5 w-3.5 text-ink-3 hover:text-danger-500" />
                </button>
              </li>
            )
          })
        )}
      </ul>

      <TrackSearchAdd crateId={crate.crateId} existingTrackIds={crate.trackIds} />

      <div className="mt-3 grid gap-2 border-t border-surface-border pt-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-ink-3">Notes</label>
          <textarea
            defaultValue={crate.notes ?? ''}
            onBlur={(e) => updateCrateDetails(crate.crateId, { notes: e.target.value || null })}
            rows={2}
            className="mt-1 w-full rounded-lg border border-surface-border bg-surface-2 px-2 py-1.5 text-xs text-ink-0 outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="text-xs text-ink-3">Tags (comma separated)</label>
          <input
            defaultValue={crate.tags.join(', ')}
            onBlur={(e) =>
              updateCrateDetails(crate.crateId, {
                tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
              })
            }
            className="mt-1 w-full rounded-lg border border-surface-border bg-surface-2 px-2 py-1.5 text-xs text-ink-0 outline-none focus:border-brand-500"
          />
        </div>
      </div>
    </div>
  )
}

function TrackSearchAdd({ crateId, existingTrackIds }: { crateId: string; existingTrackIds: string[] }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<TrackDoc[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    if (!term.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timeout = setTimeout(() => {
      void searchPlatform(term).then((res) => {
        if (!cancelled) {
          setResults(res.tracks.filter((t) => !existingTrackIds.includes(t.trackId)))
          setSearching(false)
        }
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  async function handleAdd(trackId: string) {
    setAdding(trackId)
    try {
      await addTrackToCrate(crateId, trackId)
      setResults((prev) => prev.filter((t) => t.trackId !== trackId))
      setTerm('')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="mt-3 border-t border-surface-border pt-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
        <Input
          placeholder="Search tracks to add…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="pl-8 text-xs"
        />
      </div>
      {searching ? <p className="mt-2 text-xs text-ink-3">Searching…</p> : null}
      {results.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1 rounded-lg border border-surface-border">
          {results.map((track) => (
            <TrackSearchRow key={track.trackId} track={track} onAdd={() => handleAdd(track.trackId)} adding={adding === track.trackId} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TrackSearchRow({ track, onAdd, adding }: { track: TrackDoc; onAdd: () => void; adding: boolean }) {
  const artist = useArtistSummary(track.artistId)
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-surface-3">
        {track.artworkURL ? <img src={track.artworkURL} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-ink-0">{track.title}</p>
        <p className="truncate text-ink-3">{artist?.name ?? ''}</p>
      </div>
      <Button size="sm" variant="secondary" loading={adding} onClick={onAdd}>
        Add
      </Button>
    </div>
  )
}
