import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeMySupportHistory } from '@/services/supportService'
import { getArtistProfile } from '@/services/artistService'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/common/Button'
import { formatCurrency } from '@/utils/format'
import type { TransactionDoc } from '@/types/finance'
import type { ArtistProfile } from '@/types/artist'

function formatDate(value: TransactionDoc['createdAt']): string {
  if (!value) return ''
  return value.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Fan account access has always been free — there is no subscription tier
 * to pick here. This page is a record of one-off support payments a fan has
 * made directly to artists (each paid straight to the artist via Stripe
 * Connect, minus BackTheVibes' platform fee) — never a plan to manage.
 */
export function SubscriptionPage() {
  const { firebaseUser } = useAuth()
  const [params] = useSearchParams()
  const [history, setHistory] = useState<TransactionDoc[] | null>(null)
  const [artistNames, setArtistNames] = useState<Record<string, ArtistProfile | null>>({})

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeMySupportHistory(firebaseUser.uid, setHistory)
  }, [firebaseUser])

  useEffect(() => {
    if (!history) return
    const missing = [...new Set(history.map((tx) => tx.artistId))].filter((id) => !(id in artistNames))
    if (missing.length === 0) return
    void Promise.all(missing.map((id) => getArtistProfile(id).then((p) => [id, p] as const))).then((entries) => {
      setArtistNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history])

  const totalMinor = (history ?? []).reduce((sum, tx) => sum + tx.grossMinor, 0)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Your support</h1>
        <p className="mt-1 text-sm text-ink-2">
          Every payment here went straight to the artist via Stripe — BackTheVibes only ever takes
          its platform fee. There's nothing to subscribe to; support is always a one-off choice.
        </p>
      </div>

      {params.get('support') === 'success' ? (
        <div className="rounded-xl border border-support-500/30 bg-support-500/5 px-4 py-3 text-sm text-ink-1">
          Thank you for your support! It can take a few seconds to appear below.
        </div>
      ) : null}

      {history === null ? (
        <LoadingState />
      ) : history.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-8 w-8 text-ink-3" />}
          title="You haven't supported an artist yet"
          description="Find an artist you love and support them directly from their profile."
          action={
            <Link to="/app/discover">
              <Button size="sm">Discover artists</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="rounded-2xl border border-surface-border bg-surface-1 p-5">
            <p className="text-sm text-ink-2">Total given</p>
            <p className="mt-1 text-2xl font-semibold text-ink-0">{formatCurrency(totalMinor, history[0]?.currency ?? 'gbp')}</p>
          </div>
          <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
            {history.map((tx) => {
              const artist = artistNames[tx.artistId]
              return (
                <div key={tx.transactionId} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <Link to={artist ? `/artist/${artist.slug}` : '#'} className="font-medium text-ink-0 hover:underline">
                      {artist?.name ?? 'Artist'}
                    </Link>
                    <p className="text-xs text-ink-3">{formatDate(tx.createdAt)}{tx.refundedAt ? ' · Refunded' : ''}</p>
                  </div>
                  <span className={tx.refundedAt ? 'text-ink-3 line-through' : 'text-support-400'}>
                    {formatCurrency(tx.grossMinor, tx.currency)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
