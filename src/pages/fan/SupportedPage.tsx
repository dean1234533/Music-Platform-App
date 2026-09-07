import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeSupportAllocations } from '@/services/supportService'
import { getArtistProfile } from '@/services/artistService'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { formatCurrency } from '@/utils/format'
import type { ArtistProfile } from '@/types/artist'

export function SupportedPage() {
  const { firebaseUser } = useAuth()
  const [rows, setRows] = useState<{ artist: ArtistProfile; amountMinor: number }[] | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeSupportAllocations(firebaseUser.uid, (allocationDoc) => {
      if (!allocationDoc) {
        setRows([])
        return
      }
      void Promise.all(
        Object.entries(allocationDoc.allocations)
          .filter(([, amount]) => amount > 0)
          .map(async ([artistId, amountMinor]) => {
            const artist = await getArtistProfile(artistId)
            return artist ? { artist, amountMinor } : null
          }),
      ).then((results) => setRows(results.filter((r): r is { artist: ArtistProfile; amountMinor: number } => r !== null)))
    })
  }, [firebaseUser])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Supported artists</h1>
        <p className="mt-1 text-sm text-ink-2">
          Where your monthly subscription goes — separate from the artists you simply follow.
        </p>
      </div>

      {rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-8 w-8 text-support-400" />}
          title="You're not supporting any artists yet"
          description="Subscribe and allocate your support from the Subscription page."
          action={
            <Link to="/app/subscription" className="text-sm font-medium text-brand-400 hover:underline">
              Go to Subscription →
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {rows.map(({ artist, amountMinor }) => (
            <Link
              key={artist.artistId}
              to={`/artist/${artist.slug}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-surface-2"
            >
              <span className="text-sm font-medium text-ink-0">{artist.name}</span>
              <span className="text-sm text-support-400">{formatCurrency(amountMinor)}/mo</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
