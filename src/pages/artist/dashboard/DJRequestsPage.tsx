import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeRequestsForArtist } from '@/services/licenceService'
import { getTrack } from '@/services/trackService'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { LicenceRequestDoc, LicenceRequestStatus } from '@/types/licence'

const COLUMNS: { status: LicenceRequestStatus[]; label: string }[] = [
  { status: ['submitted'], label: 'New' },
  { status: ['artist_review', 'negotiating'], label: 'In discussion' },
  { status: ['agreement_ready', 'awaiting_signatures'], label: 'Awaiting agreement' },
  { status: ['awaiting_payment'], label: 'Awaiting payment' },
  { status: ['approved'], label: 'Approved' },
  { status: ['rejected', 'expired', 'cancelled'], label: 'Closed' },
]

export function DJRequestsPage() {
  const { firebaseUser } = useAuth()
  const [requests, setRequests] = useState<LicenceRequestDoc[] | null>(null)
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeRequestsForArtist(firebaseUser.uid, setRequests)
  }, [firebaseUser])

  useEffect(() => {
    if (!requests) return
    const missing = requests.map((r) => r.trackId).filter((id) => !(id in trackTitles))
    if (missing.length === 0) return
    void Promise.all(missing.map((id) => getTrack(id).then((t) => [id, t?.title ?? 'Track'] as const))).then((entries) => {
      setTrackTitles((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">DJ Requests</h1>

      {requests === null ? (
        <LoadingState />
      ) : requests.length === 0 ? (
        <EmptyState title="No DJ requests yet" description="Requests appear here once a DJ asks to use a DJ-promoted track." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = requests.filter((r) => col.status.includes(r.status))
            return (
              <div key={col.label} className="flex flex-col gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {col.label} ({items.length})
                </h2>
                {items.length === 0 ? (
                  <p className="text-xs text-ink-3">Nothing here</p>
                ) : (
                  items.map((req) => (
                    <Link
                      key={req.requestId}
                      to={`/requests/${req.requestId}`}
                      className="rounded-lg border border-surface-border bg-surface-1 px-3 py-2.5 text-sm text-ink-0 hover:bg-surface-2"
                    >
                      {trackTitles[req.trackId] ?? 'Track'}
                    </Link>
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
