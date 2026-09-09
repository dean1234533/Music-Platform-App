import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { submitLicenceRequest } from '@/services/licenceService'
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

export function RequestDjAccessModal({
  trackId,
  dealId,
  onClose,
}: {
  trackId: string
  dealId?: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [intendedUse, setIntendedUse] = useState<IntendedUse>('dj_set')
  const [territory, setTerritory] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [venue, setVenue] = useState('')
  const [message, setMessage] = useState('')
  const [requestedStartDate, setRequestedStartDate] = useState('')
  const [requestedEndDate, setRequestedEndDate] = useState('')
  const [recordingIntention, setRecordingIntention] = useState(false)
  const [streamingIntention, setStreamingIntention] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await submitLicenceRequest({
        trackId,
        intendedUse,
        territory,
        expectedDate,
        venue,
        message,
        dealId: dealId ?? undefined,
        requestedStartDate: requestedStartDate || undefined,
        requestedEndDate: requestedEndDate || undefined,
        recordingIntention,
        streamingIntention,
      })
      // Called unconditionally: navigate() is a no-op when already on /dj/requests (opened from
      // that page's own "DJ promos & deals" section), which otherwise left the modal open
      // forever with no visible confirmation that the request actually went through.
      onClose()
      navigate('/dj/requests')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={dealId ? 'Request final deal terms' : 'Request DJ access'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <Label>Intended use</Label>
          <select
            value={intendedUse}
            onChange={(e) => setIntendedUse(e.target.value as IntendedUse)}
            className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-base sm:text-sm text-ink-0"
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Requested start date</Label>
            <Input type="date" value={requestedStartDate} onChange={(e) => setRequestedStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Requested end date</Label>
            <Input type="date" value={requestedEndDate} onChange={(e) => setRequestedEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Venue (if relevant)</Label>
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-1">
            <input type="checkbox" checked={recordingIntention} onChange={(e) => setRecordingIntention(e.target.checked)} className="h-4 w-4" />
            I intend to record this
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-1">
            <input type="checkbox" checked={streamingIntention} onChange={(e) => setStreamingIntention(e.target.checked)} className="h-4 w-4" />
            I intend to stream this
          </label>
        </div>
        <div>
          <Label>Additional request details</Label>
          <TextArea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button onClick={handleSubmit} loading={submitting}>
          Send for artist approval
        </Button>
      </div>
    </Modal>
  )
}
