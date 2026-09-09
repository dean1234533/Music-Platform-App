import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listArtistAgreements, listDjAgreements } from '@/services/licenceService'
import { getTrack } from '@/services/trackService'
import { getUserProfile } from '@/services/userService'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { AgreementStatus, LicenceAgreementDoc } from '@/types/licence'

/** One tab can span several raw statuses — e.g. "Void / Cancelled" covers both terminal non-fulfilment states. */
const TABS: { label: string; statuses: AgreementStatus[] }[] = [
  { label: 'Awaiting Signature', statuses: ['pending', 'ready_for_signature', 'artist_signed', 'dj_signed', 'fully_signed'] },
  { label: 'Awaiting Payment', statuses: ['awaiting_payment'] },
  { label: 'Active', statuses: ['active'] },
  { label: 'Expired', statuses: ['expired'] },
  { label: 'Void / Cancelled', statuses: ['void', 'cancelled', 'superseded'] },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function MyAgreementsPage() {
  const navigate = useNavigate()
  const { firebaseUser, hasRole } = useAuth()
  const [agreements, setAgreements] = useState<LicenceAgreementDoc[] | null>(null)
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({})
  const [partyNames, setPartyNames] = useState<Record<string, string>>({})
  // null = "no tab explicitly chosen yet" — land on the first tab that actually has
  // something in it (e.g. Active once a request is complete) instead of always opening on
  // Awaiting Signature even when it's empty. Once the DJ/artist clicks a tab, it sticks.
  const [activeTab, setActiveTab] = useState<number | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    let cancelled = false
    async function load() {
      const [asDj, asArtist] = await Promise.all([
        hasRole('dj') ? listDjAgreements(firebaseUser!.uid) : Promise.resolve([]),
        hasRole('artist') ? listArtistAgreements(firebaseUser!.uid) : Promise.resolve([]),
      ])
      if (cancelled) return
      const merged = [...asDj, ...asArtist].filter(
        (a, i, arr) => arr.findIndex((b) => b.agreementId === a.agreementId) === i,
      )
      merged.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      setAgreements(merged)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [firebaseUser, hasRole])

  useEffect(() => {
    if (!agreements) return
    const missingTracks = agreements.map((a) => a.trackId).filter((id) => !(id in trackTitles))
    if (missingTracks.length > 0) {
      void Promise.all(missingTracks.map((id) => getTrack(id).then((t) => [id, t?.title ?? 'Track'] as const))).then((entries) => {
        setTrackTitles((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
      })
    }
    const missingParties = [
      ...new Set(agreements.map((a) => (a.djId === firebaseUser?.uid ? a.artistId : a.djId)).filter((id) => !(id in partyNames))),
    ]
    if (missingParties.length > 0) {
      void Promise.all(missingParties.map((id) => getUserProfile(id).then((p) => [id, p?.displayName || 'User'] as const))).then((entries) => {
        setPartyNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreements])

  const grouped = TABS.map((tab) => ({
    ...tab,
    items: (agreements ?? []).filter((a) => tab.statuses.includes(a.status)),
  }))
  const defaultTab = grouped.findIndex((tab) => tab.items.length > 0)
  const effectiveTab = activeTab ?? (defaultTab === -1 ? 0 : defaultTab)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex w-fit items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-2xl font-semibold text-ink-0">My Agreements</h1>

      {agreements === null ? (
        <LoadingState />
      ) : agreements.length === 0 ? (
        <EmptyState title="No agreements yet" description="Signed DJ licence agreements will appear here." />
      ) : (
        <>
          <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-full border border-surface-border bg-surface-1 p-1">
            {grouped.map((tab, i) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  effectiveTab === i ? 'bg-surface-3 text-ink-0' : 'text-ink-2 hover:text-ink-0'
                }`}
              >
                {tab.label} ({tab.items.length})
              </button>
            ))}
          </div>

          {grouped[effectiveTab]!.items.length === 0 ? (
            <EmptyState title={`Nothing in ${grouped[effectiveTab]!.label}`} />
          ) : (
            <div className="flex flex-col gap-3">
              {grouped[effectiveTab]!.items.map((agreement) => {
                const isDj = agreement.djId === firebaseUser?.uid
                const otherPartyId = isDj ? agreement.artistId : agreement.djId
                const bothSigned = Boolean(agreement.artistAcceptedAt && agreement.djAcceptedAt)
                const thisPartyHasSigned = isDj ? Boolean(agreement.djAcceptedAt) : Boolean(agreement.artistAcceptedAt)
                let actionLabel = 'View agreement'
                if (['pending', 'ready_for_signature', 'artist_signed', 'dj_signed'].includes(agreement.status) && !thisPartyHasSigned) actionLabel = 'Sign agreement'
                else if (agreement.status === 'awaiting_payment' && isDj) actionLabel = 'Pay licence fee'
                else if (agreement.status === 'active') actionLabel = isDj ? 'View & download track' : 'View agreement'

                return (
                  <Link
                    key={agreement.agreementId}
                    to={`/agreements/${agreement.agreementId}`}
                    className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface-1 p-4 hover:bg-surface-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-0">{trackTitles[agreement.trackId] ?? 'Track'}</p>
                        <p className="text-xs text-ink-2">
                          {isDj ? 'Artist' : 'DJ'}: {partyNames[otherPartyId] ?? 'Loading…'}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-ink-0">
                        {agreement.licenceFeeMinor > 0 ? formatCurrency(agreement.licenceFeeMinor, agreement.currency) : 'Free'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
                      <span>ID: {agreement.agreementId.slice(0, 10)}…</span>
                      <span>Signed: {bothSigned ? formatDate(agreement.finalisedAt ? agreement.finalisedAt.toDate().toISOString() : null) : 'Not yet'}</span>
                      <span>Expires: {formatDate(agreement.expiryDate)}</span>
                    </div>
                    <span className="w-fit rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-400">{actionLabel}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
