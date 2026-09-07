import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listArtistAgreements, listDjAgreements } from '@/services/licenceService'
import { getTrack } from '@/services/trackService'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { LicenceAgreementDoc } from '@/types/licence'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting signatures',
  awaiting_payment: 'Awaiting payment',
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
  void: 'Void',
  superseded: 'Superseded',
}

export function MyAgreementsPage() {
  const navigate = useNavigate()
  const { firebaseUser, hasRole } = useAuth()
  const [agreements, setAgreements] = useState<LicenceAgreementDoc[] | null>(null)
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({})

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
    const missing = agreements.map((a) => a.trackId).filter((id) => !(id in trackTitles))
    if (missing.length === 0) return
    void Promise.all(missing.map((id) => getTrack(id).then((t) => [id, t?.title ?? 'Track'] as const))).then((entries) => {
      setTrackTitles((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreements])

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
        <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {agreements.map((agreement) => {
            const isDj = agreement.djId === firebaseUser?.uid
            return (
              <Link
                key={agreement.agreementId}
                to={`/agreements/${agreement.agreementId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-0">{trackTitles[agreement.trackId] ?? 'Track'}</p>
                  <p className="text-xs text-ink-2">{isDj ? 'Artist licence' : 'DJ licence'}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-2">
                  {agreement.licenceFeeMinor > 0 ? formatCurrency(agreement.licenceFeeMinor, agreement.currency) : 'Free'}
                </span>
                <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-1">
                  {STATUS_LABEL[agreement.status] ?? agreement.status}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
