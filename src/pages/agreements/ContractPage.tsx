import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CreditCard, Download, PenLine, Printer } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { createLicencePaymentSession, getSecureDownloadUrl, getSignatureImageUrls, subscribeAgreement } from '@/services/licenceService'
import { submitReport } from '@/services/moderationService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { getTrack } from '@/services/trackService'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/common/Button'
import { TextArea } from '@/components/common/Input'
import { SignAgreementModal } from '@/components/licence/SignAgreementModal'
import { formatCurrency } from '@/utils/format'
import type { LicenceAgreementDoc } from '@/types/licence'
import type { TrackDoc } from '@/types/track'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting signatures',
  ready_for_signature: 'Ready for signature',
  artist_signed: 'Artist signed',
  dj_signed: 'DJ signed',
  fully_signed: 'Fully signed',
  awaiting_payment: 'Awaiting payment',
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
  void: 'Void',
  superseded: 'Superseded',
}

export function ContractPage() {
  const { agreementId } = useParams<{ agreementId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { firebaseUser } = useAuth()
  const [agreement, setAgreement] = useState<LicenceAgreementDoc | null | undefined>(undefined)
  const [track, setTrack] = useState<TrackDoc | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [showSignModal, setShowSignModal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [signatureImages, setSignatureImages] = useState<Record<'artist' | 'dj', string | null>>({ artist: null, dj: null })
  const artist = useArtistSummary(agreement?.artistId ?? null)

  useEffect(() => {
    if (!agreementId) return
    return subscribeAgreement(agreementId, setAgreement, () => setLoadError(true))
  }, [agreementId])

  useEffect(() => {
    if (!agreement) return
    void getTrack(agreement.trackId).then(setTrack)
  }, [agreement])

  useEffect(() => {
    if (!agreementId || !(agreement?.artistAcceptedAt || agreement?.djAcceptedAt)) return
    void getSignatureImageUrls({ agreementId }).then(({ signatures }) => {
      setSignatureImages({
        artist: signatures.find((s) => s.role === 'artist')?.url ?? null,
        dj: signatures.find((s) => s.role === 'dj')?.url ?? null,
      })
    })
  }, [agreementId, agreement?.artistAcceptedAt, agreement?.djAcceptedAt])

  if (agreement === undefined && loadError) {
    return <ErrorState title="Something went wrong" description="Couldn't load this page. Try refreshing." />
  }
  if (agreement === undefined) return <LoadingState label="Loading contract…" />
  if (agreement === null || !firebaseUser) return <EmptyState title="Contract not found" />

  const belongsToArtist = agreement.artistId === firebaseUser.uid
  const belongsToDj = agreement.djId === firebaseUser.uid
  if (!belongsToArtist && !belongsToDj) return <EmptyState title="You don't have access to this contract" />
  const isDualRoleAgreement = belongsToArtist && belongsToDj
  const requestedRole = searchParams.get('as')
  const actingRole = isDualRoleAgreement
    ? requestedRole === 'dj' ? 'dj' : 'artist'
    : belongsToArtist ? 'artist' : 'dj'
  const isDj = actingRole === 'dj'
  const hasSigned = isDj ? Boolean(agreement.djAcceptedAt) : Boolean(agreement.artistAcceptedAt)
  const isSignable = ['pending', 'ready_for_signature', 'artist_signed', 'dj_signed'].includes(agreement.status)

  async function handlePay() {
    setBusy(true)
    setActionError(null)
    try {
      const origin = window.location.origin
      const { url } = await createLicencePaymentSession({
        agreementId: agreement!.agreementId,
        actingRole,
        successUrl: `${origin}/agreements/${agreement!.agreementId}?as=dj&payment=success`,
        cancelUrl: `${origin}/agreements/${agreement!.agreementId}?as=dj&payment=cancelled`,
      })
      window.location.href = url
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not start payment.')
      setBusy(false)
    }
  }

  async function handleDownload() {
    setBusy(true)
    setActionError(null)
    try {
      const { url } = await getSecureDownloadUrl({ agreementId: agreement!.agreementId, actingRole })
      // window.location.href would navigate this whole tab away to the raw file, losing this
      // page (and its Back button) entirely — open it in a new tab instead so the contract
      // page stays put.
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not prepare the download.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 print:px-0 print:py-0">
      <style>{`@media print { nav, header, .no-print { display: none !important; } }`}</style>
      <div className="mb-6 flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink-0">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <Link to={isDj ? '/dj/requests' : '/dashboard/artist/dj-requests'} className="text-sm text-ink-2 hover:text-ink-0">
            My Agreements
          </Link>
        </div>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {isDualRoleAgreement ? (
        <div className="mb-5 rounded-2xl border border-brand-400/30 bg-brand-500/[0.06] p-4 no-print">
          <p className="text-sm font-semibold text-ink-0">Complete both sides of this contract</p>
          <p className="mt-1 text-xs text-ink-2">Switch sides to add the artist signature, the DJ signature, then make payment as the DJ.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant={actingRole === 'artist' ? 'primary' : 'secondary'} onClick={() => setSearchParams({ as: 'artist' })}>Artist side</Button>
            <Button size="sm" variant={actingRole === 'dj' ? 'primary' : 'secondary'} onClick={() => setSearchParams({ as: 'dj' })}>DJ side</Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-surface-border bg-surface-1 p-6 print:border-0 print:bg-transparent print:p-0 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">DJ Licence Agreement</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-0">
          {agreement.trackTitleSnapshot ?? track?.title ?? 'Track'} — v{agreement.agreementVersion}
        </h1>
        <p className="mt-1 text-xs text-ink-3">Agreement ID: {agreement.agreementId}</p>
        <p className="mt-1 text-xs text-ink-3">
          Status: <span className="font-medium text-ink-1">{STATUS_LABEL[agreement.status] ?? agreement.status}</span>
        </p>

        <div className="mt-5 rounded-xl border border-brand-400/20 bg-brand-500/[0.06] p-4 no-print">
          {isSignable && !hasSigned ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-0">Review and sign this contract</p>
                <p className="mt-1 text-xs text-ink-2">Track access stays locked until both parties agree to these terms.</p>
              </div>
              <Button size="sm" onClick={() => setShowSignModal(true)} className="shrink-0">
                <PenLine className="h-4 w-4" /> Sign agreement
              </Button>
            </div>
          ) : isSignable ? (
            <p className="text-sm text-ink-1">You have signed. Waiting for the other party to sign.</p>
          ) : agreement.status === 'awaiting_payment' && isDj ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-0">Contract signed — payment is next</p>
                <p className="mt-1 text-xs text-ink-2">Pay securely to unlock the full-quality track download.</p>
              </div>
              <Button size="sm" onClick={handlePay} loading={busy} className="shrink-0">
                <CreditCard className="h-4 w-4" /> Pay {formatCurrency(agreement.licenceFeeMinor, agreement.currency)}
              </Button>
            </div>
          ) : agreement.status === 'awaiting_payment' ? (
            <p className="text-sm text-ink-1">Both parties signed. Waiting for the DJ to complete payment.</p>
          ) : agreement.status === 'active' && isDj ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-0">Licensed track ready</p>
                <p className="mt-1 text-xs text-ink-2">Your signed licence is active. Download the full-quality audio file.</p>
              </div>
              <Button size="sm" onClick={handleDownload} loading={busy} className="shrink-0">
                <Download className="h-4 w-4" /> Download track
              </Button>
            </div>
          ) : agreement.status === 'active' ? (
            <p className="text-sm text-ink-1">The licence is active and the DJ can download the track.</p>
          ) : null}
          {actionError ? <p className="mt-3 text-sm text-danger-500">{actionError}</p> : null}
        </div>

        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <Party
            label="Artist"
            name={agreement.artistLegalName || agreement.artistNameSnapshot || artist?.name || 'Not yet signed'}
            userId={agreement.artistId}
            signedAt={agreement.artistAcceptedAt}
            signatureImageUrl={signatureImages.artist}
          />
          <Party
            label="DJ"
            name={agreement.djLegalName || agreement.djNameSnapshot || 'Not yet signed'}
            userId={agreement.djId}
            signedAt={agreement.djAcceptedAt}
            signatureImageUrl={signatureImages.dj}
          />
        </div>

        <Section title="Track">
          <Field label="Title" value={track?.title ?? '—'} />
          <Field label="Track ID" value={agreement.trackId} />
        </Section>

        <Section title="Rights & permitted use">
          <Field label="Rights-holder declaration" value={agreement.rightsHolderDeclaration ? 'Confirmed by artist' : 'Not recorded'} />
          <Field label="Permitted use" value={agreement.permittedUse} />
          <Field label="Territory" value={agreement.territory} />
          <Field label="Start date" value={formatDate(agreement.startDate)} />
          <Field label="Expiry date" value={agreement.expiryDate ? formatDate(agreement.expiryDate) : 'No expiry'} />
        </Section>

        <Section title="Payment">
          <Field label="Price" value={agreement.licenceFeeMinor > 0 ? formatCurrency(agreement.licenceFeeMinor, agreement.currency) : 'Free'} />
          <Field label="Payment required" value={agreement.licenceFeeMinor > 0 ? 'Yes' : 'No'} />
          <Field label="Paid" value={agreement.paidAt ? 'Yes' : agreement.licenceFeeMinor > 0 ? 'Not yet' : 'N/A'} />
        </Section>

        <Section title="Usage terms">
          <Field label="Recording permitted" value={agreement.recordingPermission ? 'Yes' : 'No'} />
          <Field label="Streaming permitted" value={agreement.streamingPermission ? 'Yes' : 'No'} />
          <Field label="Promotional mix permitted" value={agreement.promotionalMixPermission ? 'Yes' : 'No'} />
          <Field label="Redistribution allowed" value={agreement.redistributionAllowed ? 'Yes' : 'No'} />
          <Field label="Resale allowed" value={agreement.resaleAllowed ? 'Yes' : 'No'} />
          <Field label="Remix allowed" value={agreement.remixAllowed ? 'Yes' : 'No'} />
          <Field label="Attribution requirements" value={agreement.attributionRequirements || 'None specified'} />
        </Section>

        {agreement.additionalTerms ? (
          <Section title="Additional conditions">
            <p className="text-sm text-ink-1">{agreement.additionalTerms}</p>
          </Section>
        ) : null}

        <p className="mt-6 text-xs leading-5 text-ink-3">
          <strong className="text-ink-2">Rights granted.</strong> This licence grants the DJ only the specific,
          listed uses above (permitted use, territory, duration, and any recording/streaming/promotional-mix/remix/
          redistribution/resale permissions marked "Yes" in Usage terms) — nothing beyond what is explicitly listed.
          Except where a permission above is explicitly marked "Yes", the DJ receives no ownership, resale,
          redistribution, remix, synchronisation, publishing, or master-recording rights of any kind. The artist
          (and/or their label, publisher, or rights-holder) remains the sole owner of the underlying recording and
          composition throughout and after this licence. This record is a platform-managed statement of agreement
          between the parties, not a substitute for independent legal advice — REQUIRES QUALIFIED MUSIC/IP LEGAL
          REVIEW BEFORE PRODUCTION.
        </p>

        <div className="mt-6 border-t border-surface-border pt-4 no-print">
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-danger-500"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Report a problem with this agreement
          </button>
        </div>
      </div>
      {showSignModal ? (
        <SignAgreementModal
          agreementId={agreement.agreementId}
          agreementVersion={agreement.agreementVersion}
          contentHash={agreement.contentHash ?? ''}
          uid={firebaseUser.uid}
          actingRole={actingRole}
          onClose={() => setShowSignModal(false)}
          onSigned={() => setShowSignModal(false)}
        />
      ) : null}
      {showReportModal ? (
        <ReportAgreementModal agreementId={agreement.agreementId} onClose={() => setShowReportModal(false)} />
      ) : null}
    </div>
  )
}

/**
 * Files a support ticket against this agreement — never rewrites terms,
 * signatures, or payment/status fields itself. An admin reviews it in
 * AdminReportsPage and, if warranted, places a legal hold or takes a
 * separate explicit action; nothing here touches the contract automatically.
 */
function ReportAgreementModal({ agreementId, onClose }: { agreementId: string; onClose: () => void }) {
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit() {
    if (!description.trim()) {
      setError('Please describe the problem.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await submitReport({ targetType: 'agreement', targetId: agreementId, reason: 'agreement_dispute', description: description.trim() })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-surface-border bg-surface-1 p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink-0">Report a problem with this agreement</h2>
        {sent ? (
          <>
            <p className="mt-3 text-sm text-ink-1">
              Thanks — support will review this. Reporting a problem does not change this contract's terms,
              signatures, or payment status by itself.
            </p>
            <Button size="sm" className="mt-4" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-xs text-ink-2">
              Use this if the other party isn't honouring the agreed terms, or something about this contract needs
              support's attention. This is not a chat — it goes to BackTheVibes support, not the other party, and
              will not automatically change the contract.
            </p>
            <TextArea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the problem…"
              className="mt-3"
            />
            {error ? <p className="mt-2 text-xs text-danger-500">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" loading={busy} onClick={() => void submit()}>
                Send report
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Party({
  label,
  name,
  userId,
  signedAt,
  signatureImageUrl,
}: {
  label: string
  name: string
  userId: string
  signedAt: unknown
  signatureImageUrl: string | null
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-2 p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-sm font-medium text-ink-0">{name}</p>
      <p className="mt-1 text-xs text-ink-3">ID: {userId}</p>
      <p className="mt-1 text-xs text-ink-3">{signedAt ? 'Signed' : 'Not yet signed'}</p>
      {signatureImageUrl ? (
        <img
          src={signatureImageUrl}
          alt={`${label} signature`}
          className="mt-2 h-14 w-full max-w-[220px] rounded-md border border-surface-border bg-white object-contain object-left p-1"
        />
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{children}</dl>
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
