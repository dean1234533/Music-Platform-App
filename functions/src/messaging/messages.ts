import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import type { DocumentData, DocumentReference } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { enforceRateLimit } from '../rateLimit.js'

export type MessageKind = 'text' | 'system' | 'offer_card' | 'contract_status' | 'payment_status'

/**
 * Minimal shape shared by Transaction and WriteBatch for the two methods
 * used here. A plain `Transaction | WriteBatch` union isn't callable in TS
 * (their overloaded `set`/`update` signatures don't unify across the
 * union), so callers pass either and this structural type accepts both.
 */
interface BatchLikeWriter {
  set(ref: DocumentReference, data: DocumentData): unknown
  update(ref: DocumentReference, data: DocumentData): unknown
}

/**
 * Posts a platform-generated message into a conversation as part of the
 * caller's own transaction/batch — never exposed as its own callable, so a
 * client can never forge a system/offer/contract-status message (the
 * `messages` subcollection is `allow write: if false` for every path).
 * `actingUserId` is recorded as senderId for audit purposes only; the UI
 * never renders a system message as "from" that user.
 */
export function writeSystemMessage(
  writer: BatchLikeWriter,
  conversationRef: DocumentReference,
  actingUserId: string,
  kind: MessageKind,
  text: string,
  extra: { offerId?: string; agreementId?: string } = {},
) {
  const messageRef = conversationRef.collection('messages').doc()
  writer.set(messageRef, {
    messageId: messageRef.id,
    conversationId: conversationRef.id,
    senderId: actingUserId,
    kind,
    text,
    offerId: extra.offerId ?? null,
    agreementId: extra.agreementId ?? null,
    readBy: [],
    createdAt: FieldValue.serverTimestamp(),
  })
  writer.update(conversationRef, {
    lastMessageAt: FieldValue.serverTimestamp(),
    lastMessagePreview: text.slice(0, 140),
  })
}

const MAX_MESSAGE_LENGTH = 4000

export const sendMessage = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid
  const { conversationId, text } = request.data ?? {}
  if (!conversationId || typeof conversationId !== 'string') {
    throw new HttpsError('invalid-argument', 'conversationId is required.')
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new HttpsError('invalid-argument', 'Message text is required.')
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError('invalid-argument', 'Message is too long.')
  }

  const conversationRef = db.collection('conversations').doc(conversationId)
  const conversationSnap = await conversationRef.get()
  if (!conversationSnap.exists) throw new HttpsError('not-found', 'Conversation not found.')
  const participantIds = (conversationSnap.data()?.participantIds ?? []) as string[]
  if (!participantIds.includes(uid)) {
    throw new HttpsError('permission-denied', 'You are not part of this conversation.')
  }

  await enforceRateLimit(`sendMessage_${uid}`, 30, 60)

  const messageRef = conversationRef.collection('messages').doc()
  await db.runTransaction(async (tx) => {
    tx.set(messageRef, {
      messageId: messageRef.id,
      conversationId,
      senderId: uid,
      kind: 'text',
      text: text.trim(),
      offerId: null,
      agreementId: null,
      readBy: [uid],
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.update(conversationRef, {
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessagePreview: text.trim().slice(0, 140),
    })
  })

  const recipients = participantIds.filter((id) => id !== uid)
  await Promise.all(
    recipients.map((recipientId) =>
      db.collection('notifications').add({
        userId: recipientId,
        type: 'new_message',
        title: 'New message',
        body: text.trim().slice(0, 140),
        linkTo: `/messages/${conversationId}`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      }),
    ),
  )

  return { messageId: messageRef.id }
})
