import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { ConversationDoc, MessageDoc } from '@/types/conversation'

export const sendMessage = callable<{ conversationId: string; text: string }, { messageId: string }>('sendMessage')

export function subscribeConversation(conversationId: string, onChange: (conversation: ConversationDoc | null) => void) {
  return onSnapshot(doc(db, 'conversations', conversationId), (snap) => {
    onChange(snap.exists() ? (snap.data() as ConversationDoc) : null)
  })
}

export function subscribeMessages(conversationId: string, onChange: (rows: MessageDoc[]) => void) {
  const q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data() as MessageDoc)))
}
