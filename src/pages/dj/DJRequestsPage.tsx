import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeRequestsForDj } from '@/services/licenceService'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { LicenceRequestDoc } from '@/types/licence'

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

export function DJRequestsPage() {
  const { firebaseUser } = useAuth()
  const [requests, setRequests] = useState<LicenceRequestDoc[] | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeRequestsForDj(firebaseUser.uid, setRequests)
  }, [firebaseUser])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Requests</h1>
      {requests === null ? (
        <LoadingState />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-8 w-8 text-dj-400" />}
          title="No requests yet"
          description="Request access to a DJ-promoted track from its track page."
        />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {requests.map((req) => (
            <RequestRow key={req.requestId} request={req} />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestRow({ request }: { request: LicenceRequestDoc }) {
  const artist = useArtistSummary(request.artistId)
  return (
    <Link to={`/requests/${request.requestId}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
      <span className="text-sm text-ink-0">{artist?.name ?? 'Artist'}</span>
      <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-1">{STATUS_LABEL[request.status] ?? request.status}</span>
    </Link>
  )
}
