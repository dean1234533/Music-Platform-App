import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import { submitLicenceRequest } from '@/services/licenceService'
import { useCanRequestDjLicence } from '@/hooks/useEntitlements'
import type { IntendedUse } from '@/types/licence'

const USE_OPTIONS: { value: IntendedUse; label: string }[] = [
  { value: 'live_club_performance', label: 'Live club performance' },
  { value: 'festival_performance', label: 'Festival performance' },
  { value: 'radio_show', label: 'Radio show' },
  { value: 'dj_set', label: 'DJ set' },
  { value: 'promotional_mix', label: 'Promotional mix' },
  { value: 'online_stream', label: 'Online stream' },
  { value: 'other', label: 'Other' },
]

export function RequestDjAccessModal({ trackId, onClose }: { trackId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const { allowed: canRequest, remaining, loading: limitLoading } = useCanRequestDjLicence()
  const [intendedUse, setIntendedUse] = useState<IntendedUse>('dj_set')
  const [territory, setTerritory] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [venue, setVenue] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const { requestId } = await submitLicenceRequest({ trackId, intendedUse, territory, expectedDate, venue, message })
      navigate(`/requests/${requestId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Request DJ access" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {!limitLoading && !canRequest ? (
          <UpgradePrompt
            role="dj"
            reason="You've used your DJ requests for this month."
            cta="Upgrade to DJ Pro"
          />
        ) : null}
        <fieldset disabled={!limitLoading && !canRequest} className="contents">
        <div>
          <Label>Intended use</Label>
          <select
            value={intendedUse}
            onChange={(e) => setIntendedUse(e.target.value as IntendedUse)}
            className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0"
          >
            {USE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Territory</Label>
            <Input value={territory} onChange={(e) => setTerritory(e.target.value)} placeholder="e.g. UK" />
          </div>
          <div>
            <Label>Expected date</Label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Venue (if relevant)</Label>
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div>
          <Label>Message to the artist</Label>
          <TextArea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button onClick={handleSubmit} loading={submitting}>
          Send request
        </Button>
        </fieldset>
        {!limitLoading && canRequest && remaining !== -1 ? (
          <p className="text-xs text-ink-3">{remaining} request{remaining === 1 ? '' : 's'} remaining this month.</p>
        ) : null}
      </div>
    </Modal>
  )
}
