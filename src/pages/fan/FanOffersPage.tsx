import { useEffect, useMemo, useState } from 'react'
import { Gift } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { listFollowedArtistIds } from '@/services/followService'
import { listSupportedArtistIds } from '@/services/supportService'
import { claimFanOffer, removeFanOfferClaim, subscribeOwnFanOfferClaims, subscribeVisibleFanOffers } from '@/services/fanOfferService'
import { FanOfferCard } from '@/components/music/FanOfferCard'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { FanOfferClaimDoc, FanOfferDoc } from '@/types/fanOffer'

export function FanOffersPage() {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const [followedIds, setFollowedIds] = useState<string[] | null>(null)
  const [supportedIds, setSupportedIds] = useState<string[]>([])
  const [offersByArtist, setOffersByArtist] = useState<Record<string, FanOfferDoc[]>>({})
  const [claims, setClaims] = useState<FanOfferClaimDoc[]>([])
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    void Promise.all([listFollowedArtistIds(firebaseUser.uid), listSupportedArtistIds(firebaseUser.uid)]).then(([followed, supported]) => {
      setFollowedIds(Array.from(new Set([...followed, ...supported])))
      setSupportedIds(supported)
    })
    return subscribeOwnFanOfferClaims(firebaseUser.uid, setClaims)
  }, [firebaseUser])

  useEffect(() => {
    if (!followedIds) return
    setOffersByArtist({})
    const unsubscribers = followedIds.map((artistId) => subscribeVisibleFanOffers(artistId, { isFollowing: true, isSupporting: supportedIds.includes(artistId) }, (offers) => setOffersByArtist((current) => ({ ...current, [artistId]: offers }))))
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [followedIds, supportedIds])

  const offers = useMemo(() => Object.values(offersByArtist).flat().sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)), [offersByArtist])
  const claimedIds = useMemo(() => new Set(claims.map((claim) => claim.offerId)), [claims])

  async function toggleClaim(offer: FanOfferDoc) {
    if (!firebaseUser) return
    setPendingId(offer.offerId)
    try {
      if (claimedIds.has(offer.offerId)) {
        await removeFanOfferClaim(firebaseUser.uid, offer.offerId)
        notify(`Removed your claim for “${offer.title}”.`, 'info')
      } else {
        await claimFanOffer(firebaseUser.uid, offer)
        notify(`Claimed “${offer.title}”. Redemption details are now unlocked.`)
      }
    } catch {
      notify('Could not update this offer. Please try again.', 'error')
    } finally {
      setPendingId(null)
    }
  }

  if (followedIds === null) return <LoadingState label="Loading your offers…" />

  return (
    <div className="flex flex-col gap-7">
      <div><p className="eyebrow">From your artists</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-ink-0">Offers</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">Claim benefits shared by artists you follow and exclusive rewards from artists you support.</p></div>
      {offers.length === 0 ? <EmptyState icon={<Gift className="h-8 w-8 text-brand-400" />} title="No offers available yet" description="New offers from artists you follow or support will appear here." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{offers.map((offer) => <FanOfferCard key={offer.offerId} offer={offer} claimed={claimedIds.has(offer.offerId)} pending={pendingId === offer.offerId} onClaim={() => void toggleClaim(offer)} />)}</div>}
    </div>
  )
}
