import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { subscribeArtistDeals } from '@/services/dealService'
import { updateTrackDealSettings } from '@/services/trackService'
import { useAuth } from '@/contexts/AuthContext'
import type { TrackDjDealSettings } from '@/types/deal'
import type { TrackDoc } from '@/types/track'

const DEFAULT_SETTINGS: TrackDjDealSettings = {
  acceptDjRequests: true,
  allowedDealIds: [],
  defaultDealId: null,
  minimumPriceMinor: null,
  verifiedDjsOnly: false,
  customApprovalRequired: false,
}

export function TrackDealSettingsModal({ track, onClose }: { track: TrackDoc; onClose: () => void }) {
  const { firebaseUser } = useAuth()
  const [deals, setDeals] = useState<{ dealId: string; name: string }[]>([])
  const [settings, setSettings] = useState<TrackDjDealSettings>(track.djDealSettings ?? DEFAULT_SETTINGS)
  const [minPrice, setMinPrice] = useState(
    track.djDealSettings?.minimumPriceMinor != null ? String(track.djDealSettings.minimumPriceMinor / 100) : '',
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistDeals(firebaseUser.uid, (rows) => setDeals(rows.map((d) => ({ dealId: d.dealId, name: d.name }))))
  }, [firebaseUser])

  function toggleDeal(dealId: string) {
    setSettings((s) => ({
      ...s,
      allowedDealIds: s.allowedDealIds.includes(dealId)
        ? s.allowedDealIds.filter((id) => id !== dealId)
        : [...s.allowedDealIds, dealId],
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateTrackDealSettings(track.trackId, {
        ...settings,
        minimumPriceMinor: minPrice ? Math.round(Number(minPrice) * 100) : null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`DJ deals for "${track.title}"`} onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex items-center gap-2.5 text-ink-1">
          <input
            type="checkbox"
            checked={settings.acceptDjRequests}
            onChange={(e) => setSettings((s) => ({ ...s, acceptDjRequests: e.target.checked }))}
            className="h-4 w-4"
          />
          Accept DJ requests on this track
        </label>

        {settings.acceptDjRequests ? (
          <>
            <p className="text-xs text-ink-3">
              DJs can send a request without choosing a deal. If manual approval is enabled, you review every request before an offer can proceed.
            </p>
            {deals.length === 0 ? (
              <p className="rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-xs text-ink-1">
                No reusable deals yet, so DJs will only see "Custom deal — talk to the artist," not real terms.{' '}
                <Link to="/dashboard/artist/deals" className="font-medium text-brand-400 hover:underline">
                  Create a deal first →
                </Link>
              </p>
            ) : null}
            <div>
              <Label>Allowed deals</Label>
              {deals.length === 0 ? (
                <p className="text-xs text-ink-3">Deals you create show up here to assign.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {deals.map((d) => (
                    <label key={d.dealId} className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-2 px-2.5 py-2 text-xs text-ink-1">
                      <input type="checkbox" checked={settings.allowedDealIds.includes(d.dealId)} onChange={() => toggleDeal(d.dealId)} className="h-3.5 w-3.5" />
                      {d.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {settings.allowedDealIds.length > 0 ? (
              <div>
                <Label>Default deal (shown first)</Label>
                <select
                  value={settings.defaultDealId ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultDealId: e.target.value || null }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0"
                >
                  <option value="">None</option>
                  {deals
                    .filter((d) => settings.allowedDealIds.includes(d.dealId))
                    .map((d) => (
                      <option key={d.dealId} value={d.dealId}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}

            <div>
              <Label>Minimum price (optional)</Label>
              <Input type="number" min={0} step="0.01" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="No minimum" />
            </div>

            <label className="flex items-center gap-2.5 text-ink-1">
              <input
                type="checkbox"
                checked={settings.verifiedDjsOnly}
                onChange={(e) => setSettings((s) => ({ ...s, verifiedDjsOnly: e.target.checked }))}
                className="h-4 w-4"
              />
              Verified DJs only
            </label>
            <label className="flex items-center gap-2.5 text-ink-1">
              <input
                type="checkbox"
                checked={settings.customApprovalRequired}
                onChange={(e) => setSettings((s) => ({ ...s, customApprovalRequired: e.target.checked }))}
                className="h-4 w-4"
              />
              Require manual approval for every request
            </label>
          </>
        ) : null}

        <Button onClick={handleSave} loading={saving} className="w-fit">
          Save
        </Button>
      </div>
    </Modal>
  )
}
