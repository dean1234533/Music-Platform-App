import { collection, onSnapshot, orderBy, query, where, limit as fsLimit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TransactionDoc } from '@/types/finance'

/**
 * Every payment (fan support, DJ licence) reaches the artist directly via a
 * Stripe Connect destination charge — there is no internal balance to read.
 * This is a read-only bookkeeping history; the artist's real, authoritative
 * balance and payout schedule live in their own Stripe Dashboard.
 */
export function subscribeArtistTransactions(
  artistId: string,
  onChange: (rows: TransactionDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'transactions'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'), fsLimit(100))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as TransactionDoc)),
    (error) => {
      console.error('[subscribeArtistTransactions] listener error:', error)
      onError?.(error)
    },
  )
}
