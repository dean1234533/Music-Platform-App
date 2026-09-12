import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Download, HandCoins, Info, Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistTransactions } from '@/services/revenueService'
import { beginConnectOnboarding, openConnectDashboard, subscribeArtistPayoutAccount } from '@/services/connectService'
import { listArtistDownloadLogs } from '@/services/licenceService'
import { getTrack } from '@/services/trackService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { ArtistPayoutAccountDoc, TransactionDoc } from '@/types/finance'
import type { DownloadLogDoc } from '@/types/licence'

const TYPE_LABEL: Record<TransactionDoc['type'], string> = {
  artist_support: 'Fan support',
  dj_licence_income: 'DJ licence income',
  artist_membership_income: 'Artist Membership fee',
}

export function RevenuePage() {
  const { firebaseUser } = useAuth()
  const [transactions, setTransactions] = useState<TransactionDoc[] | null>(null)
  const [payoutAccount, setPayoutAccount] = useState<ArtistPayoutAccountDoc | null>(null)
  const [downloads, setDownloads] = useState<DownloadLogDoc[] | null>(null)
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({})
  const [downloadTrackFilter, setDownloadTrackFilter] = useState('all')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    const unsub1 = subscribeArtistTransactions(firebaseUser.uid, setTransactions)
    const unsub2 = subscribeArtistPayoutAccount(firebaseUser.uid, setPayoutAccount)
    void listArtistDownloadLogs(firebaseUser.uid).then(setDownloads)
    return () => {
      unsub1()
      unsub2()
    }
  }, [firebaseUser])

  useEffect(() => {
    if (!downloads) return
    const missing = [...new Set(downloads.map((d) => d.trackId).filter((id) => !(id in trackTitles)))]
    if (missing.length === 0) return
    void Promise.all(missing.map((id) => getTrack(id).then((t) => [id, t?.title ?? 'Deleted track'] as const))).then((entries) => {
      setTrackTitles((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloads])

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    try {
      await beginConnectOnboarding()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start onboarding.')
      setConnecting(false)
    }
  }

  const currency = transactions?.[0]?.currency ?? 'gbp'
  // artist_membership_income is a fee the artist PAID for platform access, not earnings —
  // excluded here so it can't inflate this figure, even though it still shows in the list below.
  const lifetimeNetMinor = (transactions ?? [])
    .filter((tx) => tx.type !== 'artist_membership_income')
    .reduce((sum, tx) => sum + tx.netMinor, 0)

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink-0">Revenue</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={<HandCoins className="h-4.5 w-4.5" />} label="Lifetime earnings on BackTheVibes" value={formatCurrency(lifetimeNetMinor, currency)} accent="brand" />
        <StatCard icon={<Wallet className="h-4.5 w-4.5" />} label="Payouts" value={payoutAccount?.payoutsEnabled ? 'Automatic via Stripe' : 'Connect Stripe to get paid'} accent="neutral" />
      </div>

      <section className="rounded-2xl border border-surface-border bg-surface-1 p-5 sm:p-6">
        <p className="eyebrow text-brand-400">Revenue</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink-0">Get paid directly by Stripe</h2>
        <p className="mt-1.5 flex items-start gap-2 text-sm leading-6 text-ink-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
          Every fan support payment and DJ/business licence fee is paid straight to your connected
          Stripe account the moment it's made — BackTheVibes only ever takes its platform fee.
          There's no BackTheVibes balance to withdraw: Stripe pays out to your bank on its own
          schedule, and you can see and manage that schedule in your Stripe Dashboard.
        </p>

        {!payoutAccount?.chargesEnabled ? (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#635bff] text-base font-bold text-white">S</div>
              <div>
                <p className="text-sm font-semibold text-ink-0">Connect Stripe</p>
                <p className="text-xs text-ink-3">Required before fans or DJs/businesses can pay you.</p>
              </div>
            </div>
            <Button onClick={handleConnect} loading={connecting} className="w-full sm:w-auto">
              Connect Stripe
            </Button>
          </div>
        ) : (
          <div className="mt-5">
            <Button variant="secondary" onClick={openConnectDashboard} className="w-full sm:w-auto">
              Open Stripe dashboard
            </Button>
          </div>
        )}
        {error ? <p className="mt-2 text-sm text-danger-500">{error}</p> : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Transactions</h2>
        {transactions === null ? (
          <LoadingState />
        ) : transactions.length === 0 ? (
          <EmptyState icon={<Wallet className="h-8 w-8 text-ink-3" />} title="No transactions yet" />
        ) : (
          <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
            {transactions.map((tx) => (
              <div key={tx.transactionId} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-ink-0">{TYPE_LABEL[tx.type]}{tx.refundedAt ? ' (refunded)' : ''}</span>
                <span className={tx.refundedAt ? 'text-ink-3 line-through' : tx.type === 'artist_membership_income' ? 'text-ink-2' : 'text-support-400'}>
                  {tx.type === 'artist_membership_income' ? '-' : '+'}{formatCurrency(tx.netMinor, tx.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-0">Download history</h2>
          {downloads && downloads.length > 0 ? (
            <select
              value={downloadTrackFilter}
              onChange={(e) => setDownloadTrackFilter(e.target.value)}
              className="rounded-lg border border-surface-border bg-surface-2 px-2.5 py-1.5 text-xs text-ink-0"
            >
              <option value="all">All tracks</option>
              {[...new Set(downloads.map((d) => d.trackId))].map((trackId) => (
                <option key={trackId} value={trackId}>
                  {trackTitles[trackId] ?? 'Loading…'}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {downloads === null ? (
          <LoadingState />
        ) : downloads.length === 0 ? (
          <EmptyState icon={<Download className="h-8 w-8 text-ink-3" />} title="No downloads yet" />
        ) : (
          (() => {
            const filtered = downloadTrackFilter === 'all' ? downloads : downloads.filter((d) => d.trackId === downloadTrackFilter)
            return filtered.length === 0 ? (
              <EmptyState icon={<Download className="h-8 w-8 text-ink-3" />} title="No downloads for this track" />
            ) : (
              <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
                {filtered.map((d, index) => (
                  <div key={`${d.agreementId}-${index}`} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-ink-0">{trackTitles[d.trackId] ?? 'Track'}</span>
                    <span className="text-ink-2">
                      {d.timestamp ? d.timestamp.toDate().toLocaleDateString() : '—'} · v{d.fileVersion}
                    </span>
                  </div>
                ))}
              </div>
            )
          })()
        )}
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  accent: 'brand' | 'support' | 'neutral'
}) {
  const accentClasses = {
    brand: 'border-brand-400/20 bg-brand-500/10 text-brand-400',
    support: 'border-support-400/20 bg-support-500/10 text-support-400',
    neutral: 'border-white/10 bg-white/[0.05] text-ink-1',
  }
  return (
    <div className="rounded-xl border border-surface-border bg-surface-1 p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${accentClasses[accent]}`}>{icon}</div>
      <p className="mt-3 text-xl font-semibold text-ink-0">{value}</p>
      <p className="mt-0.5 text-xs text-ink-2">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
    </div>
  )
}
