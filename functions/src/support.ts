import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'
import { requireActiveUser } from './roles.js'
import { requireAdmin, writeAuditLog } from './admin/guard.js'
import { enforceRateLimit } from './rateLimit.js'

export const submitSupportMessage = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  await enforceRateLimit(`submitSupportMessage_${request.auth.uid}`, 5, 3600)

  const subject = typeof request.data?.subject === 'string' ? request.data.subject.trim() : ''
  const message = typeof request.data?.message === 'string' ? request.data.message.trim() : ''
  if (subject.length < 3 || subject.length > 200) {
    throw new HttpsError('invalid-argument', 'Subject must be 3–200 characters.')
  }
  if (message.length < 10 || message.length > 5000) {
    throw new HttpsError('invalid-argument', 'Message must be 10–5000 characters.')
  }

  const userSnap = await db.collection('users').doc(request.auth.uid).get()
  const user = userSnap.data()

  const ref = db.collection('supportMessages').doc()
  const batch = db.batch()
  batch.set(ref, {
    supportMessageId: ref.id,
    userId: request.auth.uid,
    userEmail: user?.email ?? request.auth.token.email ?? null,
    userName: user?.displayName ?? null,
    subject,
    message,
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
  })

  // Nobody was ever told a new support message existed — an admin only
  // found out by remembering to check Admin -> Reports. Notify every admin
  // account the same way every other event in the app does (bell + push).
  const adminsSnap = await db.collection('users').where('roles', 'array-contains', 'admin').get()
  for (const adminDoc of adminsSnap.docs) {
    batch.set(db.collection('notifications').doc(), {
      userId: adminDoc.id,
      type: 'support_message',
      title: 'New support message',
      body: `${user?.displayName ?? 'Someone'}: ${subject}`,
      linkTo: '/admin/reports',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
  }

  await batch.commit()
  return { supportMessageId: ref.id }
})

const MIN_REPLY_LENGTH = 3
const MAX_REPLY_LENGTH = 5000

export const resolveSupportMessage = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const supportMessageId = request.data?.supportMessageId
  if (!supportMessageId || typeof supportMessageId !== 'string') {
    throw new HttpsError('invalid-argument', 'supportMessageId is required.')
  }
  const reply = typeof request.data?.reply === 'string' ? request.data.reply.trim() : ''
  if (reply.length < MIN_REPLY_LENGTH || reply.length > MAX_REPLY_LENGTH) {
    throw new HttpsError('invalid-argument', `Reply must be ${MIN_REPLY_LENGTH}–${MAX_REPLY_LENGTH} characters.`)
  }

  const ref = db.collection('supportMessages').doc(supportMessageId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Support message not found.')
  const supportMessage = snap.data()!

  const batch = db.batch()
  batch.update(ref, {
    status: 'resolved',
    reply,
    repliedAt: FieldValue.serverTimestamp(),
    resolvedBy: adminId,
    resolvedAt: FieldValue.serverTimestamp(),
  })
  // The reply itself is the whole point of resolving — surface it directly
  // rather than a content-free "your ticket was closed" notification.
  batch.set(db.collection('notifications').doc(), {
    userId: supportMessage.userId,
    type: 'support_reply',
    title: `Re: ${supportMessage.subject}`,
    body: reply.slice(0, 140),
    linkTo: '/support',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()

  await writeAuditLog(adminId, 'resolve_support_message', { supportMessageId })
  return { ok: true }
})
