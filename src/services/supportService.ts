import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { SupportAllocationDoc } from '@/types/subscription'

export function subscribeIsSupporting(
  fanId: string,
  artistId: string,
  onChange: (supporting: boolean) => void,
  onError?: (error: Error) => void,
) {
  let relationshipExists = false
  let activeSubscription = false
  let relationshipReady = false
  let subscriptionReady = false
  const emit = () => {
    if (relationshipReady && subscriptionReady) onChange(relationshipExists && activeSubscription)
  }
  const handleError = (error: Error) => {
      console.error('[subscribeIsSupporting] listener error:', error)
      onError?.(error)
  }
  const unsubscribeRelationship = onSnapshot(doc(db, 'supportRelationships', `${fanId}_${artistId}`), (snap) => {
    relationshipExists = snap.exists()
    relationshipReady = true
    emit()
  }, handleError)
  const unsubscribeSubscription = onSnapshot(doc(db, 'subscriptions', `${fanId}_fan`), (snap) => {
    const status = snap.data()?.status
    activeSubscription = status === 'active' || status === 'trialing'
    subscriptionReady = true
    emit()
  }, handleError)
  return () => {
    unsubscribeRelationship()
    unsubscribeSubscription()
  }
}

export async function listSupportedArtistIds(fanId: string): Promise<string[]> {
  const [subscription, snap] = await Promise.all([
    getDoc(doc(db, 'subscriptions', `${fanId}_fan`)),
    getDocs(query(collection(db, 'supportRelationships'), where('fanId', '==', fanId))),
  ])
  const status = subscription.data()?.status
  if (status !== 'active' && status !== 'trialing') return []
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

export function subscribeSupportAllocations(
  fanId: string,
  onChange: (doc: SupportAllocationDoc | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'supportAllocations', fanId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as SupportAllocationDoc) : null)
    },
    (error) => {
      console.error('[subscribeSupportAllocations] listener error:', error)
      onError?.(error)
    },
  )
}
