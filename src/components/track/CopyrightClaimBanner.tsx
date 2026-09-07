import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { TextArea } from '@/components/common/Input'
import { submitArtistResponse, submitCounterNotice } from '@/services/moderationService'
import type { CopyrightClaimDoc } from '@/types/moderation'

const STATUS_LABEL: Record<CopyrightClaimDoc['status'], string> = {
  submitted: 'Claim submitted',
  under_review: 'Under review',
  information_required: 'More information needed',
  artist_notified: 'Response received',
  temporarily_restricted: 'Temporarily restricted',
  removed: 'Removed',
  rejected: 'Claim rejected',
  resolved: 'Resolved',
  restored: 'Restored',
  appealed: 'Appealed',
  counter_noticed: 'Counter-notice filed',
}

/** Shown on an artist's own track when a copyright claim exists against it. Lets them respond and, once restricted/removed, file a counter-notice. */
export function CopyrightClaimBanner({ claim, trackTitle }: { claim: CopyrightClaimDoc; trackTitle: string }) {
  const [response, setResponse] = useState('')
  const [counterNotice, setCounterNotice] = useState('')
  const [submittingResponse, setSubmittingResponse] = useState(false)
  const [submittingCounterNotice, setSubmittingCounterNotice] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRespond = !claim.artistResponse && !['resolved', 'rejected', 'restored'].includes(claim.status)
  const canCounterNotice = ['removed', 'temporarily_restricted'].includes(claim.status) && !claim.counterNoticeText

  async function handleRespond() {
    if (!response.trim()) return
    setSubmittingResponse(true)
    setError(null)
    try {
      await submitArtistResponse({ claimId: claim.claimId, response: response.trim() })
      setResponse('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your response.')
    } finally {
      setSubmittingResponse(false)
    }
  }

  async function handleCounterNotice() {
    if (!counterNotice.trim()) return
    setSubmittingCounterNotice(true)
    setError(null)
    try {
      await submitCounterNotice({ claimId: claim.claimId, counterNoticeText: counterNotice.trim() })
      setCounterNotice('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your counter-notice.')
    } finally {
      setSubmittingCounterNotice(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-medium text-ink-0">
        <AlertTriangle className="h-4 w-4 text-danger-500" />
        Copyright claim on "{trackTitle}" — {STATUS_LABEL[claim.status]}
      </p>
      <p className="text-ink-2">{claim.reason}</p>
      {claim.adminNote ? <p className="text-ink-2">Note from our team: {claim.adminNote}</p> : null}
      {claim.artistResponse ? <p className="text-ink-3">Your response: {claim.artistResponse}</p> : null}
      {claim.counterNoticeText ? <p className="text-ink-3">Your counter-notice: {claim.counterNoticeText}</p> : null}

      {canRespond ? (
        <div className="flex flex-col gap-2">
          <TextArea rows={2} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Explain your side — this is shared with the review team." />
          <Button size="sm" onClick={handleRespond} loading={submittingResponse} disabled={!response.trim()}>
            Send response
          </Button>
        </div>
      ) : null}

      {canCounterNotice ? (
        <div className="flex flex-col gap-2">
          <TextArea rows={2} value={counterNotice} onChange={(e) => setCounterNotice(e.target.value)} placeholder="File a counter-notice if you believe this claim is mistaken or made in error." />
          <Button size="sm" variant="secondary" onClick={handleCounterNotice} loading={submittingCounterNotice} disabled={!counterNotice.trim()}>
            Submit counter-notice
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-danger-500">{error}</p> : null}
    </div>
  )
}
