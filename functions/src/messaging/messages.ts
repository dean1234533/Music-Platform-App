import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

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

  const messageRef = conversationRef.collection('messages').doc()
  await db.runTransaction(async (tx) => {
    tx.set(messageRef, {
      messageId: messageRef.id,
      conversationId,
      senderId: uid,
      text: text.trim(),
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
