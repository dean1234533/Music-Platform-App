import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { TextArea } from '@/components/common/Input'
import { sendBulkDjOutreach } from '@/services/messagingService'

/** Sends only to DJs who have explicitly opted in to artist outreach. */
export function BulkDjOutreachModal({ trackId, trackTitle, onClose }: { trackId: string; trackTitle: string; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const { sentCount } = await sendBulkDjOutreach({ trackId, message })
      setResult(sentCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send outreach.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title={`Promote "${trackTitle}" to DJs`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-ink-3">
          Only reaches DJs who have opted in to receive promotional outreach — never a message to
          every DJ on the platform.
        </p>
        {result !== null ? (
          <p className="text-sm text-support-400">Sent to {result} opted-in DJ{result === 1 ? '' : 's'}.</p>
        ) : (
          <>
            <TextArea rows={3} placeholder="Say a bit about the release…" value={message} onChange={(e) => setMessage(e.target.value)} />
            {error ? <p className="text-sm text-danger-500">{error}</p> : null}
            <Button onClick={handleSend} loading={sending} disabled={!message.trim()}>
              Send to opted-in DJs
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
