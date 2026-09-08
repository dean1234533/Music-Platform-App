import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DjDealDoc } from '@/types/deal'

export function newDealId(): string {
  return doc(collection(db, 'djDeals')).id
}

export type CreateDealInput = Omit<DjDealDoc, 'dealId' | 'artistId' | 'createdAt' | 'updatedAt' | 'active'>

export async function createDjDeal(artistId: string, dealId: string, input: CreateDealInput): Promise<void> {
  await setDoc(doc(db, 'djDeals', dealId), {
    ...input,
    dealId,
    artistId,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateDjDeal(dealId: string, input: Partial<CreateDealInput> & { active?: boolean }): Promise<void> {
  await updateDoc(doc(db, 'djDeals', dealId), { ...input, updatedAt: serverTimestamp() })
}

export async function deleteDjDeal(dealId: string): Promise<void> {
  await deleteDoc(doc(db, 'djDeals', dealId))
}

export function subscribeArtistDeals(
  artistId: string,
  onChange: (deals: DjDealDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, 'djDeals'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as DjDealDoc)),
    (error) => {
      console.error('[subscribeArtistDeals] listener error:', error)
      onError?.(error)
    },
  )
}

/** Public — resolves track-linked deals for DJ-facing views in Firestore-safe chunks. */
export async function getDealsByIds(dealIds: string[]): Promise<DjDealDoc[]> {
  if (dealIds.length === 0) return []
  const uniqueIds = [...new Set(dealIds)]
  const chunks = Array.from({ length: Math.ceil(uniqueIds.length / 30) }, (_, index) => uniqueIds.slice(index * 30, index * 30 + 30))
  const snapshots = await Promise.all(
    chunks.map((ids) => getDocs(query(collection(db, 'djDeals'), where('dealId', 'in', ids)))),
  )
  return snapshots.flatMap((snap) => snap.docs.map((d) => d.data() as DjDealDoc))
}
