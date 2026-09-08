import { collection, doc, onSnapshot, orderBy, query, where, limit as fsLimit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { ArtistBalanceDoc, PayoutDoc, TransactionDoc } from '@/types/finance'

export function subscribeArtistBalance(
  artistId: string,
  onChange: (balance: ArtistBalanceDoc | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'artistBalances', artistId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as ArtistBalanceDoc) : null)
    },
    (error) => {
      console.error('[subscribeArtistBalance] listener error:', error)
      onError?.(error)
    },
  )
}

export function subscribeArtistTransactions(
  artistId: string,
  onChange: (rows: TransactionDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'transactions'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'), fsLimit(50))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as TransactionDoc)),
    (error) => {
      console.error('[subscribeArtistTransactions] listener error:', error)
      onError?.(error)
    },
  )
}

export function subscribeArtistPayouts(
  artistId: string,
  onChange: (rows: PayoutDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'payouts'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'), fsLimit(50))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as PayoutDoc)),
    (error) => {
      console.error('[subscribeArtistPayouts] listener error:', error)
      onError?.(error)
    },
  )
}

export const requestPayout = callable<void, { payoutId: string; amountMinor: number }>('requestPayout')
