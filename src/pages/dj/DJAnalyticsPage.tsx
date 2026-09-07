import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeRequestsForDj, listDjAgreements, listDjDownloadLogs } from '@/services/licenceService'
import { TierRoute } from '@/components/auth/TierRoute'
import { LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { DownloadLogDoc, LicenceAgreementDoc, LicenceRequestDoc } from '@/types/licence'

function monthKey(ts: { toDate: () => Date } | null): string {
  if (!ts) return 'unknown'
  const d = ts.toDate()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function countBy<T>(rows: T[], keyOf: (row: T) => string): [string, number][] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyOf(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function DJAnalyticsContent() {
  const { firebaseUser } = useAuth()
  const [requests, setRequests] = useState<LicenceRequestDoc[] | null>(null)
  const [agreements, setAgreements] = useState<LicenceAgreementDoc[] | null>(null)
  const [downloads, setDownloads] = useState<DownloadLogDoc[] | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeRequestsForDj(firebaseUser.uid, setRequests)
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    void listDjAgreements(firebaseUser.uid).then(setAgreements)
    void listDjDownloadLogs(firebaseUser.uid).then(setDownloads)
  }, [firebaseUser])

  const requestsByMonth = useMemo(() => (requests ? countBy(requests, (r) => monthKey(r.createdAt)) : []), [requests])
  const statusFunnel = useMemo(() => (requests ? countBy(requests, (r) => r.status) : []), [requests])
  const topGenres = useMemo(() => (requests ? countBy(requests, (r) => r.trackGenre || 'Unknown') : []), [requests])
  const downloadsByMonth = useMemo(() => (downloads ? countBy(downloads, (d) => monthKey(d.timestamp)) : []), [downloads])

  const paidAgreements = agreements?.filter((a) => a.paidAt) ?? []
  const totalSpendMinor = paidAgreements.reduce((sum, a) => sum + a.licenceFeeMinor, 0)
  const avgSpendMinor = paidAgreements.length > 0 ? Math.round(totalSpendMinor / paidAgreements.length) : 0
  const currency = paidAgreements[0]?.currency ?? 'GBP'

  if (requests === null || agreements === null || downloads === null) return <LoadingState />

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Analytics</h1>
        <p className="mt-1 text-sm text-ink-2">Your own licensing activity — real data only, nothing estimated.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total requests" value={String(requests.length)} />
        <StatCard label="Total spent on licences" value={formatCurrency(totalSpendMinor, currency)} />
        <StatCard label="Average licence fee" value={formatCurrency(avgSpendMinor, currency)} />
      </div>

      <Section title="Requests by month">
        <BarList rows={requestsByMonth} />
      </Section>

      <Section title="Request status">
        <BarList rows={statusFunnel} />
      </Section>

      <Section title="Top requested genres">
        <BarList rows={topGenres} />
      </Section>

      <Section title="Downloads by month">
        <BarList rows={downloadsByMonth} />
      </Section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-1 p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink-0">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-ink-0">{title}</h2>
      {children}
    </div>
  )
}

function BarList({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) return <p className="text-xs text-ink-3">No data yet.</p>
  const max = Math.max(...rows.map(([, count]) => count))
  return (
    <div className="flex flex-col gap-2">
      {rows.map(([label, count]) => (
        <div key={label} className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 truncate text-ink-2">{label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-dj-500" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-ink-1">{count}</span>
        </div>
      ))}
    </div>
  )
}

export function DJAnalyticsPage() {
  return (
    <TierRoute role="dj" requiredFeature="professionalAnalytics" reason="Professional analytics is a DJ Pro+ feature." cta="Upgrade to DJ Pro+">
      <DJAnalyticsContent />
    </TierRoute>
  )
}
