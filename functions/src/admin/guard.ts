import { HttpsError } from 'firebase-functions/v2/https'
import type { CallableRequest } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { userHasRole } from '../roles.js'

export async function requireAdmin(request: CallableRequest): Promise<string> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  if (!(await userHasRole(request.auth.uid, 'admin'))) {
    throw new HttpsError('permission-denied', 'Admin access required.')
  }
  return request.auth.uid
}

export async function writeAuditLog(adminId: string, action: string, details: Record<string, unknown>) {
  await db.collection('auditLogs').add({
    adminId,
    action,
    details,
    createdAt: FieldValue.serverTimestamp(),
  })
}
