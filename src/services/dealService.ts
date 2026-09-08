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

/** Public — used to resolve a track's allowedDealIds for the DJ-facing deal view. Firestore has no `in` on doc IDs > 30, chunk if ever needed. */
export async function getDealsByIds(dealIds: string[]): Promise<DjDealDoc[]> {
  if (dealIds.length === 0) return []
  const q = query(collection(db, 'djDeals'), where('dealId', 'in', dealIds.slice(0, 30)))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as DjDealDoc)
}
