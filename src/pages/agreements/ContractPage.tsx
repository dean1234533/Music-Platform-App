import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeAgreement } from '@/services/licenceService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { getTrack } from '@/services/trackService'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/common/Button'
import { formatCurrency } from '@/utils/format'
import type { LicenceAgreementDoc } from '@/types/licence'
import type { TrackDoc } from '@/types/track'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting signatures',
  awaiting_payment: 'Awaiting payment',
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
  void: 'Void',
  superseded: 'Superseded',
}

export function ContractPage() {
  const { agreementId } = useParams<{ agreementId: string }>()
  const { firebaseUser } = useAuth()
  const [agreement, setAgreement] = useState<LicenceAgreementDoc | null | undefined>(undefined)
  const [track, setTrack] = useState<TrackDoc | null>(null)
  const [loadError, setLoadError] = useState(false)
  const artist = useArtistSummary(agreement?.artistId ?? null)

  useEffect(() => {
    if (!agreementId) return
    return subscribeAgreement(agreementId, setAgreement, () => setLoadError(true))
  }, [agreementId])

  useEffect(() => {
    if (!agreement) return
    void getTrack(agreement.trackId).then(setTrack)
  }, [agreement])

  if (agreement === undefined && loadError) {
    return <ErrorState title="Something went wrong" description="Couldn't load this page. Try refreshing." />
  }
  if (agreement === undefined) return <LoadingState label="Loading contract…" />
  if (agreement === null || !firebaseUser) return <EmptyState title="Contract not found" />

  const isParty = agreement.artistId === firebaseUser.uid || agreement.djId === firebaseUser.uid
  if (!isParty) return <EmptyState title="You don't have access to this contract" />

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 print:px-0 print:py-0">
      <style>{`@media print { nav, header, .no-print { display: none !important; } }`}</style>
      <div className="mb-6 flex items-center justify-between no-print">
        <Link to="/agreements" className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink-0">
          <ArrowLeft className="h-4 w-4" /> My Agreements
        </Link>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-1 p-6 print:border-0 print:bg-transparent print:p-0 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">DJ Licence Agreement</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-0">
          {track?.title ?? 'Track'} — v{agreement.agreementVersion}
        </h1>
        <p className="mt-1 text-xs text-ink-3">Agreement ID: {agreement.agreementId}</p>
        <p className="mt-1 text-xs text-ink-3">
          Status: <span className="font-medium text-ink-1">{STATUS_LABEL[agreement.status] ?? agreement.status}</span>
        </p>

        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <Party
            label="Artist"
            name={agreement.artistLegalName || artist?.name || 'Not yet signed'}
            userId={agreement.artistId}
            signedAt={agreement.artistAcceptedAt}
          />
          <Party
            label="DJ"
            name={agreement.djLegalName || 'Not yet signed'}
            userId={agreement.djId}
            signedAt={agreement.djAcceptedAt}
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
          Access to this file does not transfer copyright ownership. This licence only grants the specific permitted
          uses set out above, for the stated territory and duration — the artist remains the owner of the underlying
          recording and composition. This record is a platform-managed statement of agreement between the parties,
          not a substitute for independent legal advice.
        </p>
      </div>
    </div>
  )
}

function Party({ label, name, userId, signedAt }: { label: string; name: string; userId: string; signedAt: unknown }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-2 p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-sm font-medium text-ink-0">{name}</p>
      <p className="mt-1 text-xs text-ink-3">ID: {userId}</p>
      <p className="mt-1 text-xs text-ink-3">{signedAt ? 'Signed' : 'Not yet signed'}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
      <dl className="grid grid-cols-2 gap-3 text-sm">{children}</dl>
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
