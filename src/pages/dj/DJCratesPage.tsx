import { useEffect, useState } from 'react'
import { Layers, Plus, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  addTrackToCrate,
  createCrate,
  deleteCrate,
  removeTrackFromCrate,
  subscribeOwnCrates,
  updateCrateDetails,
} from '@/services/crateService'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { CrateDoc } from '@/types/crate'

export function DJCratesPage() {
  const { firebaseUser } = useAuth()
  const [crates, setCrates] = useState<CrateDoc[] | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [trackInputs, setTrackInputs] = useState<Record<string, string>>({})

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

  async function handleAddTrack(crateId: string) {
    const trackId = trackInputs[crateId]?.trim()
    if (!trackId) return
    await addTrackToCrate(crateId, trackId)
    setTrackInputs((prev) => ({ ...prev, [crateId]: '' }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Crates</h1>
        <p className="mt-1 text-sm text-ink-2">Organize saved tracks into sets.</p>
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
            <div key={crate.crateId} className="rounded-xl border border-surface-border bg-surface-1 p-4">
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
                  <li className="text-xs text-ink-3">No tracks yet.</li>
                ) : (
                  crate.trackIds.map((trackId) => (
                    <li key={trackId} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-ink-1">
                      {trackId}
                      <button type="button" onClick={() => removeTrackFromCrate(crate.crateId, trackId)}>
                        <X className="h-3.5 w-3.5 text-ink-3 hover:text-danger-500" />
                      </button>
                    </li>
                  ))
                )}
              </ul>

              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Track ID to add"
                  value={trackInputs[crate.crateId] ?? ''}
                  onChange={(e) => setTrackInputs((prev) => ({ ...prev, [crate.crateId]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTrack(crate.crateId)}
                  className="text-xs"
                />
                <Button size="sm" variant="secondary" onClick={() => handleAddTrack(crate.crateId)}>
                  Add
                </Button>
              </div>

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
          ))}
        </div>
      )}
    </div>
  )
}
