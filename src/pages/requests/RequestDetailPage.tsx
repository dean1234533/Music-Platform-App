import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, Send, ArrowLeft, ShieldOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { blockUser, subscribeIsBlocked, unblockUser } from '@/services/blockService'
import {
  createLicencePaymentSession,
  getSecureDownloadUrl,
  respondToLicenceRequest,
  subscribeAgreement,
  subscribeLicenceRequest,
  voidAgreement,
} from '@/services/licenceService'
import { sendMessage, subscribeMessages } from '@/services/messagingService'
import { getTrack } from '@/services/trackService'
import { getPlatformSettings } from '@/services/platformSettingsService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { OfferFormModal } from '@/components/licence/OfferFormModal'
import { OfferCard } from '@/components/licence/OfferCard'
import { SignAgreementModal } from '@/components/licence/SignAgreementModal'
import { Button } from '@/components/common/Button'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { LicenceAgreementDoc, LicenceOfferDoc, LicenceRequestDoc } from '@/types/licence'
import type { MessageDoc } from '@/types/conversation'
import type { TrackDoc } from '@/types/track'
import type { PlatformSettings } from '@/types/platformSettings'

const STATUS_LABEL: Record<string, string> = {
  submitted: 'New',
  artist_review: 'Under review',
  negotiating: 'In discussion',
  offer_sent: 'Offer sent',
  counter_offer: 'Counter-offer',
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
  const navigate = useNavigate()
  const { firebaseUser } = useAuth()
  const [request, setRequest] = useState<LicenceRequestDoc | null | undefined>(undefined)
  const [track, setTrack] = useState<TrackDoc | null>(null)
  const [agreement, setAgreement] = useState<LicenceAgreementDoc | null>(null)
  const [messages, setMessages] = useState<MessageDoc[]>([])
  const [messageText, setMessageText] = useState('')
  const [offerModal, setOfferModal] = useState<{ mode: 'send' | 'counter'; previousOffer: LicenceOfferDoc | null } | null>(null)
  const [showSignModal, setShowSignModal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [loadError, setLoadError] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const artist = useArtistSummary(request?.artistId ?? null)

  useEffect(() => {
    if (!requestId) return
    return subscribeLicenceRequest(requestId, setRequest, () => setLoadError(true))
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

  useEffect(() => { void getPlatformSettings().then(setPlatformSettings) }, [])

  useEffect(() => {
    if (!request || !firebaseUser) return
    const otherPartyId = request.artistId === firebaseUser.uid ? request.djId : request.artistId
    return subscribeIsBlocked(firebaseUser.uid, otherPartyId, setIsBlocked)
  }, [request, firebaseUser])

  if (request === undefined && loadError) {
    return <ErrorState title="Something went wrong" description="Couldn't load this page. Try refreshing." />
  }
  if (request === undefined) return <LoadingState label="Loading request…" />
  if (request === null || !firebaseUser) return <EmptyState title="Request not found" />

  const isArtist = request.artistId === firebaseUser.uid
  const isDj = request.djId === firebaseUser.uid
  if (!isArtist && !isDj) return <EmptyState title="You don't have access to this request" />

  const otherPartyId = isArtist ? request.djId : request.artistId

  async function handleToggleBlock() {
    setBlockBusy(true)
    try {
      if (isBlocked) await unblockUser(firebaseUser!.uid, otherPartyId)
      else await blockUser(firebaseUser!.uid, otherPartyId)
    } finally {
      setBlockBusy(false)
    }
  }

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

  async function handleVoidAgreement() {
    if (!agreement) return
    await runAction(async () => {
      await voidAgreement({ agreementId: agreement.agreementId, reason: voidReason.trim() || undefined })
      setShowVoidConfirm(false)
      setVoidReason('')
    })
  }

  const hasAcceptedAlready = isArtist ? Boolean(agreement?.artistAcceptedAt) : Boolean(agreement?.djAcceptedAt)
  const feePercent = agreement?.platformFeePercent ?? platformSettings?.djServiceFeePercent
  const platformFeeMinor = agreement?.platformFeeMinor ?? (
    agreement && feePercent !== undefined ? Math.round(agreement.licenceFeeMinor * (feePercent / 100)) : undefined
  )
  const artistNetMinor = agreement?.artistNetMinor ?? (
    agreement && platformFeeMinor !== undefined ? agreement.licenceFeeMinor - platformFeeMinor : undefined
  )
  const canOffer = ['submitted', 'negotiating', 'offer_sent', 'counter_offer', 'agreement_ready'].includes(request.status)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex w-fit items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="flex items-start justify-between gap-3">
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
        <button
          onClick={handleToggleBlock}
          disabled={blockBusy}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink-1"
          title={isBlocked ? 'Unblock this user' : 'Block this user'}
        >
          {isBlocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          {isBlocked ? 'Unblock' : 'Block'}
        </button>
      </div>
      {isBlocked ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
          You've blocked this user — they can't message you and you can't send them new requests. Messages already
          sent are still visible below.
        </p>
      ) : null}

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

      {isArtist && canOffer && !request.currentOfferId ? (
        <Button size="sm" onClick={() => setOfferModal({ mode: 'send', previousOffer: null })} className="w-fit">
          Send offer
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
          <p className="mt-3 text-xs leading-5 text-ink-3">
            Access to this file does not transfer copyright ownership. This licence only grants the specific
            permitted uses set out above, for the stated territory and duration — the artist remains the owner of
            the underlying recording and composition.
          </p>

          {agreement.licenceFeeMinor > 0 && platformFeeMinor !== undefined && artistNetMinor !== undefined ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-surface-2 p-4 text-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Payment breakdown</p>
              <div className="space-y-2">
                <div className="flex justify-between text-ink-1"><span>DJ pays</span><strong>{formatCurrency(agreement.licenceFeeMinor, agreement.currency)}</strong></div>
                <div className="flex justify-between text-ink-2"><span>Platform transaction fee ({feePercent}%)</span><span>−{formatCurrency(platformFeeMinor, agreement.currency)}</span></div>
                <div className="flex justify-between border-t border-white/10 pt-2 text-ink-0"><span>Artist receives</span><strong>{formatCurrency(artistNetMinor, agreement.currency)}</strong></div>
              </div>
              <p className="mt-3 text-xs leading-5 text-ink-3">The service fee is deducted from the agreed licence amount; the DJ is not charged an extra fee.</p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {agreement.status === 'pending' && !hasAcceptedAlready ? (
              <Button size="sm" loading={busy} onClick={() => setShowSignModal(true)}>
                Sign agreement
              </Button>
            ) : agreement.status === 'pending' ? (
              <p className="text-xs text-ink-2">Waiting for the other party to sign.</p>
            ) : null}

            {agreement.status === 'awaiting_payment' && isDj && agreement.licenceFeeMinor > 0 ? (
              <Button size="sm" loading={busy} onClick={handlePay}>
                Pay {formatCurrency(agreement.licenceFeeMinor, agreement.currency)}
              </Button>
            ) : null}

            {agreement.status === 'active' && isDj ? (
              <Button size="sm" loading={busy} onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download full-quality track
              </Button>
            ) : null}

            {['active', 'awaiting_payment'].includes(agreement.status) ? (
              <Button size="sm" variant="danger" loading={busy} onClick={() => setShowVoidConfirm(true)}>
                Void agreement
              </Button>
            ) : null}

            <Link to={`/agreements/${agreement.agreementId}`} className="text-xs font-medium text-brand-400 hover:underline">
              View full contract →
            </Link>
          </div>

          {showVoidConfirm ? (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4">
              <p className="text-sm text-ink-1">
                Voiding this agreement immediately revokes download access and ends the licence. This can't be
                undone from here — it's recorded, not deleted.
              </p>
              <input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0 outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="danger" loading={busy} onClick={handleVoidAgreement}>
                  Confirm void
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowVoidConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-3">Messages</h2>
        <div ref={scrollRef} className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-xl border border-surface-border bg-surface-1 p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-ink-2">No messages yet.</p>
          ) : (
            messages.map((m) => {
              const kind = m.kind ?? 'text'
              if (kind === 'offer_card' && m.offerId) {
                return (
                  <OfferCard
                    key={m.messageId}
                    offerId={m.offerId}
                    requestId={request.requestId}
                    uid={firebaseUser.uid}
                    onCounter={(offer) => setOfferModal({ mode: 'counter', previousOffer: offer })}
                  />
                )
              }
              if (kind === 'system' || kind === 'contract_status' || kind === 'payment_status') {
                return (
                  <p key={m.messageId} className="self-center text-center text-xs text-ink-3">
                    {m.text}
                  </p>
                )
              }
              return (
                <div
                  key={m.messageId}
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    m.senderId === firebaseUser.uid ? 'self-end bg-brand-500 text-white' : 'self-start bg-surface-3 text-ink-0'
                  }`}
                >
                  {m.text}
                </div>
              )
            })
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

      {offerModal ? (
        <OfferFormModal
          requestId={request.requestId}
          mode={offerModal.mode}
          previousOffer={offerModal.previousOffer}
          onClose={() => setOfferModal(null)}
        />
      ) : null}

      {showSignModal && agreement ? (
        <SignAgreementModal
          agreementId={agreement.agreementId}
          uid={firebaseUser.uid}
          onClose={() => setShowSignModal(false)}
          onSigned={() => {}}
        />
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
