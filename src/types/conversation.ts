import type { Timestamp } from 'firebase/firestore'

export interface ConversationDoc {
  conversationId: string
  participantIds: string[]
  trackId: string
  licenceRequestId: string
  lastMessageAt: Timestamp | null
  lastMessagePreview?: string
  createdAt: Timestamp | null
}

export interface MessageDoc {
  messageId: string
  conversationId: string
  senderId: string
  text: string
  readBy: string[]
  createdAt: Timestamp | null
}
