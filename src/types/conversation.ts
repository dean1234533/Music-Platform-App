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

export type MessageKind = 'text' | 'system' | 'offer_card' | 'contract_status' | 'payment_status'

export interface MessageDoc {
  messageId: string
  conversationId: string
  /** 'system' for platform-generated messages — senderId is the acting user for audit purposes, never rendered as "from" them. */
  senderId: string
  kind: MessageKind
  text: string
  offerId?: string | null
  agreementId?: string | null
  readBy: string[]
  createdAt: Timestamp | null
}
