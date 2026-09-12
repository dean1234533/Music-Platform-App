import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeMySupportHistory } from '@/services/supportService'
import { getArtistProfile } from '@/services/artistService'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { ArtistProfile } from '@/types/artist'
import type { TransactionDoc } from '@/types/finance'

/** Groups the fan's one-off support payments by artist — lifetime total given, not a recurring amount. */
export function SupportedPage() {
  const { firebaseUser } = useAuth()
  const [history, setHistory] = useState<TransactionDoc[] | null>(null)
  const [rows, setRows] = useState<{ artist: ArtistProfile; totalMinor: number }[] | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeMySupportHistory(firebaseUser.uid, setHistory)
  }, [firebaseUser])

  useEffect(() => {
    if (!history) return
    const totals = new Map<string, number>()
    for (const tx of history) {
      if (tx.refundedAt) continue
      totals.set(tx.artistId, (totals.get(tx.artistId) ?? 0) + tx.grossMinor)
    }
    void Promise.all(
      [...totals.entries()].map(async ([artistId, totalMinor]) => {
        const artist = await getArtistProfile(artistId)
        return artist ? { artist, totalMinor } : null
      }),
    ).then((results) => setRows(results.filter((r): r is { artist: ArtistProfile; totalMinor: number } => r !== null)))
  }, [history])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Supported artists</h1>
        <p className="mt-1 text-sm text-ink-2">
          Every artist you've directly supported, and how much you've given them in total — each
          payment goes straight to the artist via Stripe.
        </p>
      </div>

      {rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-8 w-8 text-support-400" />}
          title="You're not supporting any artists yet"
          description="Support an artist directly from their profile page."
          action={
            <Link to="/app/discover" className="text-sm font-medium text-brand-400 hover:underline">
              Discover artists →
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {rows.map(({ artist, totalMinor }) => (
            <Link
              key={artist.artistId}
              to={`/artist/${artist.slug}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-surface-2"
            >
              <span className="text-sm font-medium text-ink-0">{artist.name}</span>
              <span className="text-sm text-support-400">{formatCurrency(totalMinor)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
