import { collection, doc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { TransactionDoc } from '@/types/finance'

/**
 * "Supporting" an artist is a one-off Stripe Connect payment, never a
 * subscription — a supportRelationships doc only ever exists because a real
 * payment was recorded server-side (see functions/src/stripe/webhook.ts).
 */
export function subscribeIsSupporting(
  fanId: string,
  artistId: string,
  onChange: (supporting: boolean) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'supportRelationships', `${fanId}_${artistId}`),
    (snap) => onChange(snap.exists()),
    (error) => {
      console.error('[subscribeIsSupporting] listener error:', error)
      onError?.(error)
    },
  )
}

export async function listSupportedArtistIds(fanId: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, 'supportRelationships'), where('fanId', '==', fanId)))
  return snap.docs.map((d) => (d.data() as { artistId: string }).artistId)
}

const startSupportCheckout = callable<
  { artistId: string; amountMinor: number; successUrl: string; cancelUrl: string },
  { url: string }
>('createSupportCheckoutSession')

/**
 * Starts a Stripe Checkout session for a one-off support payment to a
 * single artist. The 20% (configurable) platform fee is computed and
 * enforced entirely server-side — see functions/src/support/checkout.ts.
 */
export async function startSupportPayment(artistId: string, amountMinor: number, returnPath = '/app/support'): Promise<void> {
  const origin = window.location.origin
  const { url } = await startSupportCheckout({
    artistId,
    amountMinor,
    successUrl: `${origin}${returnPath}?support=success`,
    cancelUrl: `${origin}${returnPath}?support=cancelled`,
  })
  window.location.href = url
}

/** A fan's own support history — every artist_support transaction they've made. */
export function subscribeMySupportHistory(
  fanId: string,
  onChange: (rows: TransactionDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(
    collection(db, 'transactions'),
    where('fanId', '==', fanId),
    where('type', '==', 'artist_support'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as TransactionDoc)),
    (error) => {
      console.error('[subscribeMySupportHistory] listener error:', error)
      onError?.(error)
    },
  )
}
