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
  await ref.set({
    supportMessageId: ref.id,
    userId: request.auth.uid,
    userEmail: user?.email ?? request.auth.token.email ?? null,
    userName: user?.displayName ?? null,
    subject,
    message,
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
  })

  return { supportMessageId: ref.id }
})

export const resolveSupportMessage = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const supportMessageId = request.data?.supportMessageId
  if (!supportMessageId || typeof supportMessageId !== 'string') {
    throw new HttpsError('invalid-argument', 'supportMessageId is required.')
  }

  await db.collection('supportMessages').doc(supportMessageId).update({
    status: 'resolved',
    resolvedBy: adminId,
    resolvedAt: FieldValue.serverTimestamp(),
  })

  await writeAuditLog(adminId, 'resolve_support_message', { supportMessageId })
  return { ok: true }
})
