import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Banknote, Clock3, Download, PiggyBank, Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistBalance, subscribeArtistPayouts, subscribeArtistTransactions, requestPayout } from '@/services/revenueService'
import { beginConnectOnboarding, openConnectDashboard, subscribeArtistPayoutAccount } from '@/services/connectService'
import { listArtistDownloadLogs } from '@/services/licenceService'
import { getTrack } from '@/services/trackService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { ArtistBalanceDoc, ArtistPayoutAccountDoc, PayoutDoc, TransactionDoc } from '@/types/finance'
import type { DownloadLogDoc } from '@/types/licence'
import { MINIMUM_ARTIST_PAYOUT_MINOR } from '@/constants/platformLimits'

const TYPE_LABEL: Record<TransactionDoc['type'], string> = {
  subscription_income: 'Subscription income',
  dj_licence_income: 'DJ licence income',
  payout: 'Payout',
}

export function RevenuePage() {
  const { firebaseUser } = useAuth()
  const [balance, setBalance] = useState<ArtistBalanceDoc | null>(null)
  const [transactions, setTransactions] = useState<TransactionDoc[] | null>(null)
  const [payouts, setPayouts] = useState<PayoutDoc[]>([])
  const [payoutAccount, setPayoutAccount] = useState<ArtistPayoutAccountDoc | null>(null)
  const [downloads, setDownloads] = useState<DownloadLogDoc[] | null>(null)
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({})
  const [downloadTrackFilter, setDownloadTrackFilter] = useState('all')
  const [connecting, setConnecting] = useState(false)
  const [payingOut, setPayingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    const unsub1 = subscribeArtistBalance(firebaseUser.uid, setBalance)
    const unsub2 = subscribeArtistTransactions(firebaseUser.uid, setTransactions)
    const unsub3 = subscribeArtistPayouts(firebaseUser.uid, setPayouts)
    const unsub4 = subscribeArtistPayoutAccount(firebaseUser.uid, setPayoutAccount)
    void listArtistDownloadLogs(firebaseUser.uid).then(setDownloads)
    return () => {
      unsub1()
      unsub2()
      unsub3()
      unsub4()
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

  async function handlePayout() {
    setPayingOut(true)
    setError(null)
    try {
      await requestPayout()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payout request failed.')
    } finally {
      setPayingOut(false)
    }
  }

  const currency = balance?.currency ?? 'gbp'

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink-0">Revenue</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Clock3 className="h-4.5 w-4.5" />} label="Pending" value={formatCurrency(balance?.pendingMinor ?? 0, currency)} hint="Clears after 7 days" accent="neutral" />
        <StatCard icon={<Wallet className="h-4.5 w-4.5" />} label="Available" value={formatCurrency(balance?.availableMinor ?? 0, currency)} accent="brand" />
        <StatCard icon={<PiggyBank className="h-4.5 w-4.5" />} label="Paid out" value={formatCurrency(balance?.paidMinor ?? 0, currency)} accent="support" />
      </div>

      <section className="rounded-2xl border border-surface-border bg-surface-1 p-5 sm:p-6">
        <p className="eyebrow text-brand-400">Revenue</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink-0">Get paid, your way</h2>
        <p className="mt-1.5 text-sm text-ink-2">Connect Stripe to receive your earnings securely and track your revenue.</p>

        {!payoutAccount?.payoutsEnabled ? (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#635bff] text-base font-bold text-white">S</div>
              <div>
                <p className="text-sm font-semibold text-ink-0">Connect Stripe</p>
                <p className="text-xs text-ink-3">Payouts, payments and earnings all in one place.</p>
              </div>
            </div>
            <Button onClick={handleConnect} loading={connecting} className="w-full sm:w-auto">
              Connect Stripe
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-surface-border bg-surface-2 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-400/20 bg-brand-500/10 text-brand-400">
                <Banknote className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">Available to pay out</p>
                <p className="text-lg font-semibold text-ink-0">{formatCurrency(balance?.availableMinor ?? 0, currency)}</p>
              </div>
              <Button size="sm" onClick={handlePayout} loading={payingOut} disabled={(balance?.availableMinor ?? 0) < MINIMUM_ARTIST_PAYOUT_MINOR} className="shrink-0">
                Request
              </Button>
            </div>
            <Button variant="secondary" onClick={openConnectDashboard} className="sm:w-auto">
              Stripe dashboard
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-3">
          {payoutAccount?.payoutsEnabled
            ? `Payouts are available once your cleared balance reaches ${formatCurrency(MINIMUM_ARTIST_PAYOUT_MINOR, currency)}.`
            : 'Connect a Stripe account to receive payouts.'}
        </p>
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
                <span className="text-ink-0">{TYPE_LABEL[tx.type]}</span>
                <span className={tx.type === 'payout' ? 'text-ink-2' : 'text-support-400'}>
                  {tx.type === 'payout' ? '-' : '+'}
                  {formatCurrency(Math.abs(tx.netMinor), tx.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {payouts.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink-0">Payout history</h2>
          <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
            {payouts.map((p) => (
              <div key={p.payoutId} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-ink-0">{p.status}</span>
                <span className="text-ink-2">{formatCurrency(p.amountMinor, p.currency)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
