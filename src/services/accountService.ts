import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'

export type AccountDeletionStatus = 'requested' | 'processing' | 'completed' | 'failed' | 'retained_limited_data'

export interface AccountDeletionDoc {
  uid: string
  status: AccountDeletionStatus
  error?: string
}

export const deleteAccount = callable<void, { ok: boolean }>('deleteAccount')
export const exportUserData = callable<void, { url: string; expiresInSeconds: number }>('exportUserData')

export function subscribeAccountDeletionStatus(
  uid: string,
  onChange: (status: AccountDeletionDoc | null) => void,
): () => void {
  return onSnapshot(doc(db, 'accountDeletions', uid), (snap) => {
    onChange(snap.exists() ? (snap.data() as AccountDeletionDoc) : null)
  })
}
