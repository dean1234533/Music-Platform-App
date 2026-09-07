import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FanOfferAudience, FanOfferClaimDoc, FanOfferDoc, FanOfferKind } from '@/types/fanOffer'

export function newFanOfferId(): string {
  return doc(collection(db, 'fanOffers')).id
}

export async function createFanOffer(
  artistId: string,
  input: {
    title: string
    description: string
    audience: FanOfferAudience
    kind: FanOfferKind
    redemption: string
    expiresAt: Date | null
  },
): Promise<string> {
  const offerId = newFanOfferId()
  await setDoc(doc(db, 'fanOffers', offerId), {
    offerId,
    artistId,
    title: input.title,
    description: input.description,
    audience: input.audience,
    kind: input.kind,
    redemption: input.redemption,
    expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
    createdAt: serverTimestamp(),
  })
  return offerId
}

export async function deleteFanOffer(offerId: string): Promise<void> {
  await deleteDoc(doc(db, 'fanOffers', offerId))
}

export function subscribeArtistFanOffers(artistId: string, onChange: (offers: FanOfferDoc[]) => void) {
  const offersQuery = query(collection(db, 'fanOffers'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'))
  return onSnapshot(offersQuery, (snapshot) => onChange(snapshot.docs.map((item) => item.data() as FanOfferDoc)))
}

export function subscribeVisibleFanOffers(
  artistId: string,
  viewer: { isFollowing: boolean; isSupporting: boolean },
  onChange: (offers: FanOfferDoc[]) => void,
): () => void {
  const audiences: FanOfferAudience[] = ['everyone']
  if (viewer.isFollowing) audiences.push('followers')
  if (viewer.isSupporting) audiences.push('supporters')
  const results = new Map<FanOfferAudience, FanOfferDoc[]>()
  const emit = () => {
    const now = Date.now()
    const merged = audiences
      .flatMap((audience) => results.get(audience) ?? [])
      .filter((offer) => !offer.expiresAt || offer.expiresAt.toMillis() > now)
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    onChange(merged)
  }
  const unsubscribers = audiences.map((audience) => {
    const offersQuery = query(
      collection(db, 'fanOffers'),
      where('artistId', '==', artistId),
      where('audience', '==', audience),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(offersQuery, (snapshot) => {
      results.set(audience, snapshot.docs.map((item) => item.data() as FanOfferDoc))
      emit()
    })
  })
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
}

function claimId(fanId: string, offerId: string) {
  return `${fanId}_${offerId}`
}

export async function claimFanOffer(fanId: string, offer: FanOfferDoc): Promise<void> {
  const id = claimId(fanId, offer.offerId)
  await setDoc(doc(db, 'fanOfferClaims', id), {
    claimId: id,
    offerId: offer.offerId,
    artistId: offer.artistId,
    fanId,
    createdAt: serverTimestamp(),
  })
}

export async function removeFanOfferClaim(fanId: string, offerId: string): Promise<void> {
  await deleteDoc(doc(db, 'fanOfferClaims', claimId(fanId, offerId)))
}

export function subscribeOwnFanOfferClaims(fanId: string, onChange: (claims: FanOfferClaimDoc[]) => void) {
  const claimsQuery = query(collection(db, 'fanOfferClaims'), where('fanId', '==', fanId))
  return onSnapshot(claimsQuery, (snapshot) => onChange(snapshot.docs.map((item) => item.data() as FanOfferClaimDoc)))
}
