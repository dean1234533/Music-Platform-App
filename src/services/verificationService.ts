import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { VerificationRequestDoc } from '@/types/moderation'

export const submitVerificationRequest = callable<{ profileType: 'artist' | 'dj' }, { verificationRequestId: string }>(
  'submitVerificationRequest',
)

export function subscribeOwnVerificationRequests(userId: string, onChange: (rows: VerificationRequestDoc[]) => void) {
  const q = query(collection(db, 'verificationRequests'), where('userId', '==', userId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data() as VerificationRequestDoc)))
}
