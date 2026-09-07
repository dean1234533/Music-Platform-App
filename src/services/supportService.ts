import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { SupportAllocationDoc } from '@/types/subscription'

export function subscribeIsSupporting(fanId: string, artistId: string, onChange: (supporting: boolean) => void) {
  return onSnapshot(doc(db, 'supportRelationships', `${fanId}_${artistId}`), (snap) => onChange(snap.exists()))
}

export async function listSupportedArtistIds(fanId: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, 'supportRelationships'), where('fanId', '==', fanId)))
  return snap.docs.map((d) => (d.data() as { artistId: string }).artistId)
}

interface AllocationInput {
  artistId: string
  amountMinor: number
}

const updateAllocationsCallable = callable<{ allocations: AllocationInput[] }, { ok: boolean; totalMinor: number }>(
  'updateSupportAllocations',
)

/** The server validates the total against the fan's actual subscription — see functions/src/support/allocations.ts. */
export async function updateSupportAllocations(allocations: AllocationInput[]): Promise<{ totalMinor: number }> {
  const result = await updateAllocationsCallable({ allocations })
  return { totalMinor: result.totalMinor }
}

export function subscribeSupportAllocations(fanId: string, onChange: (doc: SupportAllocationDoc | null) => void) {
  return onSnapshot(doc(db, 'supportAllocations', fanId), (snap) => {
    onChange(snap.exists() ? (snap.data() as SupportAllocationDoc) : null)
  })
}
