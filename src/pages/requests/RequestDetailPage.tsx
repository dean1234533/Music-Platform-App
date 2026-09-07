import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, Send } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  createLicencePaymentSession,
  getSecureDownloadUrl,
  respondToLicenceRequest,
  signAgreement,
  subscribeAgreement,
  subscribeLicenceRequest,
} from '@/services/licenceService'
import { sendMessage, subscribeMessages } from '@/services/messagingService'
import { getTrack } from '@/services/trackService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { ProposeAgreementModal } from '@/components/licence/ProposeAgreementModal'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { LicenceAgreementDoc, LicenceRequestDoc } from '@/types/licence'
import type { MessageDoc } from '@/types/conversation'
import type { TrackDoc } from '@/types/track'

const STATUS_LABEL: Record<string, string> = {
  submitted: 'New',
  artist_review: 'Under review',
  negotiating: 'In discussion',
  agreement_ready: 'Awaiting agreement',
  awaiting_signatures: 'Awaiting signatures',
  awaiting_payment: 'Awaiting payment',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export function RequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { firebaseUser } = useAuth()
  const [request, setRequest] = useState<LicenceRequestDoc | null | undefined>(undefined)
  const [track, setTrack] = useState<TrackDoc | null>(null)
  const [agreement, setAgreement] = useState<LicenceAgreementDoc | null>(null)
  const [messages, setMessages] = useState<MessageDoc[]>([])
  const [messageText, setMessageText] = useState('')
  const [showProposeModal, setShowProposeModal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const artist = useArtistSummary(request?.artistId ?? null)

  useEffect(() => {
    if (!requestId) return
    return subscribeLicenceRequest(requestId, setRequest)
  }, [requestId])

  useEffect(() => {
    if (!request) return
    void getTrack(request.trackId).then(setTrack)
    return subscribeMessages(request.conversationId, setMessages)
  }, [request])

  useEffect(() => {
    if (!request?.currentAgreementId) {
      setAgreement(null)
      return
    }
    return subscribeAgreement(request.currentAgreementId, setAgreement)
  }, [request?.currentAgreementId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  if (request === undefined) return <LoadingState label="Loading request…" />
  if (request === null || !firebaseUser) return <EmptyState title="Request not found" />

  const isArtist = request.artistId === firebaseUser.uid
  const isDj = request.djId === firebaseUser.uid
  if (!isArtist && !isDj) return <EmptyState title="You don't have access to this request" />

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSend() {
    if (!messageText.trim()) return
    const text = messageText.trim()
    setMessageText('')
    await runAction(() => sendMessage({ conversationId: request!.conversationId, text }))
  }

  async function handleSign() {
    if (!agreement) return
    await runAction(() => signAgreement({ agreementId: agreement.agreementId, agreedToTerms: true }))
  }

  async function handlePay() {
    if (!agreement) return
    const origin = window.location.origin
    await runAction(async () => {
      const { url } = await createLicencePaymentSession({
        agreementId: agreement.agreementId,
        successUrl: `${origin}/requests/${requestId}?payment=success`,
        cancelUrl: `${origin}/requests/${requestId}?payment=cancelled`,
      })
      window.location.href = url
    })
  }

  async function handleDownload() {
    if (!agreement) return
    await runAction(async () => {
      const { url } = await getSecureDownloadUrl({ agreementId: agreement.agreementId })
      window.open(url, '_blank', 'noopener,noreferrer')
    })
  }

  const hasAcceptedAlready = isArtist ? Boolean(agreement?.artistAcceptedAt) : Boolean(agreement?.djAcceptedAt)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <span className="rounded-full bg-surface-3 px-3 py-1 text-xs font-medium text-ink-1">
          {STATUS_LABEL[request.status] ?? request.status}
        </span>
        <h1 className="mt-2 text-2xl font-semibold text-ink-0">{track?.title ?? 'Track'}</h1>
        {artist ? (
          <Link to={`/artist/${artist.slug}`} className="text-sm text-ink-2 hover:underline">
            {artist.name}
          </Link>
        ) : null}
      </div>

      {error ? <p className="text-sm text-danger-500">{error}</p> : null}

      {isArtist && request.status === 'submitted' ? (
        <div className="flex gap-2">
          <Button size="sm" loading={busy} onClick={() => runAction(() => respondToLicenceRequest(request.requestId, 'start_negotiation'))}>
            Start discussion
          </Button>
          <Button size="sm" variant="danger" loading={busy} onClick={() => runAction(() => respondToLicenceRequest(request.requestId, 'reject'))}>
            Decline
          </Button>
        </div>
      ) : null}

      {isDj && ['submitted', 'negotiating'].includes(request.status) ? (
        <Button size="sm" variant="secondary" loading={busy} onClick={() => runAction(() => respondToLicenceRequest(request.requestId, 'cancel'))} className="w-fit">
          Cancel request
        </Button>
      ) : null}

      {isArtist && ['negotiating', 'agreement_ready'].includes(request.status) ? (
        <Button size="sm" onClick={() => setShowProposeModal(true)} className="w-fit">
          {agreement ? 'Update licence terms' : 'Propose licence terms'}
        </Button>
      ) : null}

      {agreement ? (
        <div className="rounded-2xl border border-surface-border bg-surface-1 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Licence agreement (v{agreement.agreementVersion})</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Permitted use" value={agreement.permittedUse} />
            <Field label="Territory" value={agreement.territory} />
            <Field label="Licence fee" value={agreement.licenceFeeMinor > 0 ? formatCurrency(agreement.licenceFeeMinor, agreement.currency) : 'Free'} />
            <Field label="Commercial use" value={agreement.commercialUse ? 'Yes' : 'No'} />
          </dl>
          {agreement.additionalTerms ? <p className="mt-3 text-xs text-ink-2">{agreement.additionalTerms}</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {agreement.status === 'pending' && !hasAcceptedAlready ? (
              <Button size="sm" loading={busy} onClick={handleSign}>
                Sign agreement
              </Button>
            ) : agreement.status === 'pending' ? (
              <p className="text-xs text-ink-2">Waiting for the other party to sign.</p>
            ) : null}

            {agreement.status === 'signed' && isDj && agreement.licenceFeeMinor > 0 && !agreement.paidAt ? (
              <Button size="sm" loading={busy} onClick={handlePay}>
                Pay {formatCurrency(agreement.licenceFeeMinor, agreement.currency)}
              </Button>
            ) : null}

            {request.status === 'approved' && isDj ? (
              <Button size="sm" loading={busy} onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download full-quality track
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-3">Messages</h2>
        <div ref={scrollRef} className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl border border-surface-border bg-surface-1 p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-ink-2">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.messageId}
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  m.senderId === firebaseUser.uid ? 'self-end bg-brand-500 text-white' : 'self-start bg-surface-3 text-ink-0'
                }`}
              >
                {m.text}
              </div>
            ))
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Write a message…"
            className="flex-1 rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
          />
          <Button size="sm" onClick={handleSend} disabled={!messageText.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showProposeModal ? (
        <ProposeAgreementModal requestId={request.requestId} onClose={() => setShowProposeModal(false)} onProposed={() => {}} />
      ) : null}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-ink-0">{value}</dd>
    </div>
  )
}
