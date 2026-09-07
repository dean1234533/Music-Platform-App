import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistBalance, subscribeArtistPayouts, subscribeArtistTransactions, requestPayout } from '@/services/revenueService'
import { beginConnectOnboarding, openConnectDashboard, subscribeArtistPayoutAccount } from '@/services/connectService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { ArtistBalanceDoc, ArtistPayoutAccountDoc, PayoutDoc, TransactionDoc } from '@/types/finance'

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
  const [connecting, setConnecting] = useState(false)
  const [payingOut, setPayingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    const unsub1 = subscribeArtistBalance(firebaseUser.uid, setBalance)
    const unsub2 = subscribeArtistTransactions(firebaseUser.uid, setTransactions)
    const unsub3 = subscribeArtistPayouts(firebaseUser.uid, setPayouts)
    const unsub4 = subscribeArtistPayoutAccount(firebaseUser.uid, setPayoutAccount)
    return () => {
      unsub1()
      unsub2()
      unsub3()
      unsub4()
    }
  }, [firebaseUser])

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
        <StatCard label="Pending" value={formatCurrency(balance?.pendingMinor ?? 0, currency)} hint="Clears after 7 days" />
        <StatCard label="Available" value={formatCurrency(balance?.availableMinor ?? 0, currency)} />
        <StatCard label="Paid out" value={formatCurrency(balance?.paidMinor ?? 0, currency)} />
      </div>

      <section className="rounded-2xl border border-surface-border bg-surface-1 p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-3">Payouts</h2>
        {!payoutAccount?.payoutsEnabled ? (
          <>
            <p className="mb-3 text-sm text-ink-2">Connect a Stripe account to receive payouts.</p>
            <Button size="sm" onClick={handleConnect} loading={connecting}>
              Connect Stripe
            </Button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handlePayout} loading={payingOut} disabled={(balance?.availableMinor ?? 0) <= 0}>
              Request payout
            </Button>
            <Button size="sm" variant="secondary" onClick={openConnectDashboard}>
              Stripe dashboard
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
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-1 p-4">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink-0">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
    </div>
  )
}
