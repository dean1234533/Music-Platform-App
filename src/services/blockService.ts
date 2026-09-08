import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function blockRef(blockerId: string, blockedId: string) {
  return doc(db, 'blockedUsers', `${blockerId}_${blockedId}`)
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  await setDoc(blockRef(blockerId, blockedId), { blockerId, blockedId, createdAt: serverTimestamp() })
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await deleteDoc(blockRef(blockerId, blockedId))
}

export function subscribeIsBlocked(
  blockerId: string,
  blockedId: string,
  onChange: (blocked: boolean) => void,
): () => void {
  return onSnapshot(blockRef(blockerId, blockedId), (snap) => onChange(snap.exists()))
}
