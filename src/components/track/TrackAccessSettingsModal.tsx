import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { regenerateTrackPreview, updateTrackAccessSettings } from '@/services/trackService'
import { PREVIEW_MAX_DURATION_SEC, PREVIEW_MIN_DURATION_SEC, SUGGESTED_PREVIEW_DURATIONS_SEC } from '@/constants/mediaConfig'
import { ACCESS_SUMMARY, VISIBILITY_OPTIONS } from '@/utils/trackAccess'
import type { TrackDoc, TrackVisibility } from '@/types/track'

function toDateInputValue(ts: TrackDoc['followerReleaseAt']): string {
  if (!ts) return ''
  return new Date(ts.toMillis()).toISOString().slice(0, 10)
}

/**
 * Fan-facing access only — deliberately separate from TrackDjAccessModal/
 * TrackDealSettingsModal. DJ licensing is its own independent system
 * (downloadLicensedTrack never reads track.visibility), so changing who can
 * stream this track for fans can never silently affect an approved DJ's
 * already-signed licence.
 */
export function TrackAccessSettingsModal({ track, onClose }: { track: TrackDoc; onClose: () => void }) {
  const [visibility, setVisibility] = useState<TrackVisibility>(track.visibility)
  const [previewEnabled, setPreviewEnabled] = useState(track.previewEnabled !== false)
  const [previewStartSec, setPreviewStartSec] = useState(track.previewStartSec)
  const [previewDurationSec, setPreviewDurationSec] = useState(track.previewDurationSec)
  const [followerReleaseDate, setFollowerReleaseDate] = useState(toDateInputValue(track.followerReleaseAt))
  const [publicReleaseDate, setPublicReleaseDate] = useState(toDateInputValue(track.publicReleaseAt))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!Number.isFinite(previewStartSec) || previewStartSec < 0 || !Number.isFinite(previewDurationSec)
      || previewDurationSec < PREVIEW_MIN_DURATION_SEC || previewDurationSec > PREVIEW_MAX_DURATION_SEC) {
      setError(`Preview timing must use a start at or after 0 and a length between ${PREVIEW_MIN_DURATION_SEC} and ${PREVIEW_MAX_DURATION_SEC} seconds.`)
      return
    }
    if (previewEnabled && track.durationSeconds && previewStartSec + previewDurationSec > track.durationSeconds) {
      setError(`The preview must end within the full ${track.durationFormatted} track.`)
      return
    }
    const accessRank: Record<TrackVisibility, number> = { public: 0, followers: 1, early_access: 2, supporters: 3, dj_only: 4, private: 5 }
    if (accessRank[visibility] > accessRank[track.visibility] && !window.confirm('This makes the full track less accessible. Existing listeners may lose full-track access. Continue?')) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const previewTimingChanged = previewStartSec !== track.previewStartSec || previewDurationSec !== track.previewDurationSec
      if (previewEnabled && previewTimingChanged) {
        await regenerateTrackPreview(track, previewStartSec, previewDurationSec)
      }
      await updateTrackAccessSettings(track.trackId, {
        visibility,
        previewEnabled,
        previewStartSec,
        previewDurationSec,
        followerReleaseAt: visibility === 'early_access' && followerReleaseDate ? new Date(followerReleaseDate) : null,
        publicReleaseAt: visibility === 'early_access' && publicReleaseDate ? new Date(publicReleaseDate) : null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these settings.')
    } finally {
      setSaving(false)
    }
  }

  const summary = ACCESS_SUMMARY[visibility]

  return (
    <Modal title={`Access settings for "${track.title}"`} onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <div>
          <Label>Who can hear the full track?</Label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as TrackVisibility)}
            className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-surface-border bg-surface-2 p-3 text-xs text-ink-2">
            <div><p className="font-semibold text-ink-1">Public</p><p className="mt-0.5">{summary.public(previewDurationSec)}</p></div>
            <div><p className="font-semibold text-ink-1">Followers</p><p className="mt-0.5">{summary.followers(previewDurationSec)}</p></div>
            <div><p className="font-semibold text-ink-1">Supporters</p><p className="mt-0.5">{summary.supporters(previewDurationSec)}</p></div>
          </div>
        </div>

        {visibility === 'early_access' ? (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
            <p className="mb-3 text-xs text-ink-2">Supporters always get the full track immediately. Set when followers (and, optionally, everyone) get it too.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Followers get full access on</Label>
                <Input type="date" value={followerReleaseDate} onChange={(e) => setFollowerReleaseDate(e.target.value)} />
              </div>
              <div>
                <Label>Public gets full access on (optional)</Label>
                <Input type="date" value={publicReleaseDate} onChange={(e) => setPublicReleaseDate(e.target.value)} />
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-surface-border bg-surface-2 p-3">
          <p className="text-xs text-ink-2">Full track</p>
          <p className="mt-0.5 font-semibold text-ink-0">{track.durationFormatted || 'Duration unavailable for this older upload'}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-1">
          <input type="checkbox" checked={previewEnabled} onChange={(e) => setPreviewEnabled(e.target.checked)} className="h-4 w-4 accent-brand-500" />
          Public preview enabled
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Preview start (seconds)</Label>
            <Input disabled={!previewEnabled} type="number" min={0} max={track.durationSeconds ? Math.max(0, track.durationSeconds - previewDurationSec) : undefined} value={previewStartSec} onChange={(e) => setPreviewStartSec(Number(e.target.value))} />
          </div>
          <div>
            <Label>Preview duration (seconds)</Label>
            <Input
              type="number"
              min={PREVIEW_MIN_DURATION_SEC}
              max={PREVIEW_MAX_DURATION_SEC}
              disabled={!previewEnabled}
              value={previewDurationSec}
              onChange={(e) => setPreviewDurationSec(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {SUGGESTED_PREVIEW_DURATIONS_SEC.map((sec) => (
            <button
              key={sec}
              type="button"
              disabled={!previewEnabled}
              onClick={() => setPreviewDurationSec(sec)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                previewDurationSec === sec
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-surface-border text-ink-2 hover:text-ink-0'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>

        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button onClick={handleSave} loading={saving} className="w-fit">
          Save
        </Button>
      </div>
    </Modal>
  )
}
