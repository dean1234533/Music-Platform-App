import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { SupportMessageDoc } from '@/types/moderation'

export const submitSupportMessage = callable<{ subject: string; message: string }, { supportMessageId: string }>(
  'submitSupportMessage',
)

/**
 * Only ever open messages — once an admin replies (resolveSupportMessage),
 * the reply is delivered via notification (bell + push), so there's
 * nothing left for this page to keep showing. Resolving is exactly what
 * makes a message drop out of this list.
 */
export function subscribeMySupportMessages(
  uid: string,
  onChange: (messages: SupportMessageDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(db, 'supportMessages'),
    where('userId', '==', uid),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as SupportMessageDoc)),
    (error) => {
      console.error('[subscribeMySupportMessages] listener error:', error)
      onError?.(error)
    },
  )
}
