import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Label, TextArea } from '@/components/common/Input'
import { submitReport } from '@/services/moderationService'

const REASONS = ['Impersonating another artist or brand', 'Misleading or offensive profile URL', 'Inappropriate content', 'Spam', 'Other'] as const

export function ReportArtistModal({ artistId, onClose }: { artistId: string; onClose: () => void }) {
  const [reason, setReason] = useState<(typeof REASONS)[number]>(REASONS[0])
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await submitReport({ targetType: 'artist', targetId: artistId, reason, description })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Report this artist profile" onClose={onClose}>
      {done ? (
        <p className="text-sm text-support-400">Thanks — an admin will review this.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <Label>Reason</Label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
              className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-base sm:text-sm text-ink-0"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Details</Label>
            <TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-danger-500">{error}</p> : null}
          <Button onClick={handleSubmit} loading={submitting}>
            Submit report
          </Button>
        </div>
      )}
    </Modal>
  )
}
