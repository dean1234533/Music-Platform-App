import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'

const TARGET_TYPES = ['track', 'artist', 'dj', 'user', 'message', 'post'] as const

export const submitReport = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const { targetType, targetId, reason, description } = request.data ?? {}
  if (!TARGET_TYPES.includes(targetType) || !targetId || !reason) {
    throw new HttpsError('invalid-argument', 'targetType, targetId, and reason are required.')
  }

  const reportRef = db.collection('reports').doc()
  await reportRef.set({
    reportId: reportRef.id,
    reporterId: request.auth.uid,
    targetType,
    targetId,
    reason,
    description: description ?? '',
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
  })

  return { reportId: reportRef.id }
})

export const adminResolveReport = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { reportId, status } = request.data ?? {}
  if (!reportId || !['resolved', 'dismissed'].includes(status)) {
    throw new HttpsError('invalid-argument', 'reportId and a valid status are required.')
  }

  await db.collection('reports').doc(reportId).update({
    status,
    reviewedBy: adminId,
    reviewedAt: FieldValue.serverTimestamp(),
  })

  await writeAuditLog(adminId, 'resolve_report', { reportId, status })
  return { ok: true }
})
