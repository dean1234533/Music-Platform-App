import { useEffect, useState } from 'react'
import { listPendingVerificationRequests, reviewVerificationRequest } from '@/services/adminService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { VerificationRequestDoc } from '@/types/moderation'

export function AdminVerificationPage() {
  const [requests, setRequests] = useState<VerificationRequestDoc[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void listPendingVerificationRequests().then(setRequests)
  }, [])

  async function handleReview(id: string, approve: boolean) {
    setBusyId(id)
    try {
      await reviewVerificationRequest({ verificationRequestId: id, approve })
      setRequests((prev) => prev?.filter((r) => r.verificationRequestId !== id) ?? null)
    } finally {
      setBusyId(null)
    }
  }

  if (requests === null) return <LoadingState />

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Verification requests</h1>
      {requests.length === 0 ? (
        <EmptyState title="No pending requests" />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {requests.map((req) => (
            <div key={req.verificationRequestId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink-0">{req.userId}</p>
                <p className="text-xs text-ink-2">{req.profileType}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" loading={busyId === req.verificationRequestId} onClick={() => handleReview(req.verificationRequestId, true)}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={busyId === req.verificationRequestId}
                  onClick={() => handleReview(req.verificationRequestId, false)}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
