import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { SupportMessageDoc } from '@/types/moderation'

export const submitSupportMessage = callable<{ subject: string; message: string }, { supportMessageId: string }>(
  'submitSupportMessage',
)

export function subscribeMySupportMessages(
  uid: string,
  onChange: (messages: SupportMessageDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, 'supportMessages'), where('userId', '==', uid), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as SupportMessageDoc)),
    (error) => {
      console.error('[subscribeMySupportMessages] listener error:', error)
      onError?.(error)
    },
  )
}
