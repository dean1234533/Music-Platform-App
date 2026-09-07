import { useEffect, useState } from 'react'
import { adminResolveReport, listCopyrightClaims, listOpenReports, reviewCopyrightClaim } from '@/services/adminService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { CopyrightClaimDoc, ReportDoc } from '@/types/moderation'

export function AdminReportsPage() {
  const [reports, setReports] = useState<ReportDoc[] | null>(null)
  const [claims, setClaims] = useState<CopyrightClaimDoc[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void listOpenReports().then(setReports)
    void listCopyrightClaims().then(setClaims)
  }, [])

  async function resolveReport(id: string, status: 'resolved' | 'dismissed') {
    setBusyId(id)
    try {
      await adminResolveReport({ reportId: id, status })
      setReports((prev) => prev?.filter((r) => r.reportId !== id) ?? null)
    } finally {
      setBusyId(null)
    }
  }

  async function resolveClaim(id: string, status: 'removed' | 'rejected') {
    setBusyId(id)
    try {
      await reviewCopyrightClaim({ claimId: id, status })
      setClaims((prev) => prev?.filter((c) => c.claimId !== id) ?? null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink-0">Reports & copyright</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Copyright claims</h2>
        {claims === null ? (
          <LoadingState />
        ) : claims.length === 0 ? (
          <EmptyState title="No open copyright claims" />
        ) : (
          <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
            {claims.map((claim) => (
              <div key={claim.claimId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-0">{claim.reason}</p>
                  <p className="text-xs text-ink-2">{claim.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" loading={busyId === claim.claimId} onClick={() => resolveClaim(claim.claimId, 'removed')}>
                    Remove track
                  </Button>
                  <Button size="sm" variant="secondary" loading={busyId === claim.claimId} onClick={() => resolveClaim(claim.claimId, 'rejected')}>
                    Reject claim
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Reports</h2>
        {reports === null ? (
          <LoadingState />
        ) : reports.length === 0 ? (
          <EmptyState title="No open reports" />
        ) : (
          <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
            {reports.map((report) => (
              <div key={report.reportId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-0">
                    {report.targetType}: {report.reason}
                  </p>
                  <p className="text-xs text-ink-2">{report.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" loading={busyId === report.reportId} onClick={() => resolveReport(report.reportId, 'resolved')}>
                    Resolve
                  </Button>
                  <Button size="sm" variant="secondary" loading={busyId === report.reportId} onClick={() => resolveReport(report.reportId, 'dismissed')}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
