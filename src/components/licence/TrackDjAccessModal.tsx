import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { updateTrackDjAccess } from '@/services/trackService'
import type { LicenceMode, TrackDoc } from '@/types/track'

const LICENCE_OPTIONS: { value: LicenceMode; label: string }[] = [
  { value: 'not_available', label: 'Not available for DJ use' },
  { value: 'free', label: 'Free' },
  { value: 'fixed_price', label: 'Fixed price' },
  { value: 'custom_price', label: 'Custom price' },
  { value: 'negotiated', label: 'Negotiated' },
]

export function TrackDjAccessModal({ track, onClose }: { track: TrackDoc; onClose: () => void }) {
  const [djPromotion, setDjPromotion] = useState(track.djPromotion)
  const [djLicenceMode, setDjLicenceMode] = useState<LicenceMode>(track.djLicenceMode)
  const [djFixedPrice, setDjFixedPrice] = useState(track.djFixedPrice != null ? String(track.djFixedPrice / 100) : '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateTrackDjAccess(track.trackId, {
        djPromotion,
        djLicenceMode,
        djFixedPrice: djLicenceMode === 'fixed_price' && djFixedPrice ? Math.round(Number(djFixedPrice) * 100) : null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`DJ access for "${track.title}"`} onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex items-center gap-2.5 text-ink-1">
          <input
            type="checkbox"
            checked={djPromotion}
            onChange={(e) => setDjPromotion(e.target.checked)}
            className="h-4 w-4"
          />
          Available for DJ promotion — list this track in DJ discovery and allow requests
        </label>

        {djPromotion ? (
          <>
            <div>
              <Label>Licence terms</Label>
              <select
                value={djLicenceMode}
                onChange={(e) => setDjLicenceMode(e.target.value as LicenceMode)}
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
              >
                {LICENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {djLicenceMode === 'fixed_price' ? (
              <div>
                <Label>Price (GBP)</Label>
                <Input type="number" min={0} step="0.01" value={djFixedPrice} onChange={(e) => setDjFixedPrice(e.target.value)} />
              </div>
            ) : null}
            {djLicenceMode === 'not_available' ? (
              <p className="text-xs text-ink-3">
                "Not available for DJ use" keeps the track out of DJ discovery even with promotion on — pick a real
                licence term above for DJs to actually be able to request it.
              </p>
            ) : null}
          </>
        ) : null}

        <Button onClick={handleSave} loading={saving} className="w-fit">
          Save
        </Button>
      </div>
    </Modal>
  )
}
