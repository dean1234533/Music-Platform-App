import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'

/**
 * Backend for the breach register described in SECURITY_INCIDENT_RESPONSE.md.
 * Deliberately minimal — this records facts and decisions an admin enters
 * manually while working an incident (per that document's workflow), it
 * does not detect or classify incidents automatically. Every write goes
 * through one of these two admin-only callables so the record is never
 * client-editable and every change is itself audit-logged.
 */
export const adminCreateSecurityIncident = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { incidentType, affectedSystems, affectedDataCategories, estimatedUsersAffected, riskAssessment, notes } =
    request.data ?? {}
  if (!incidentType || typeof incidentType !== 'string') {
    throw new HttpsError('invalid-argument', 'incidentType is required.')
  }

  const ref = db.collection('securityIncidents').doc()
  await ref.set({
    incidentId: ref.id,
    detectedAt: FieldValue.serverTimestamp(),
    incidentType,
    affectedSystems: Array.isArray(affectedSystems) ? affectedSystems : [],
    affectedDataCategories: Array.isArray(affectedDataCategories) ? affectedDataCategories : [],
    estimatedUsersAffected: typeof estimatedUsersAffected === 'number' ? estimatedUsersAffected : null,
    riskAssessment: typeof riskAssessment === 'string' ? riskAssessment : '',
    actionsTaken: [],
    containedAt: null,
    resolvedAt: null,
    notificationDecision: 'pending_assessment',
    notes: typeof notes === 'string' ? notes : '',
    createdBy: adminId,
    updatedAt: FieldValue.serverTimestamp(),
  })

  await writeAuditLog(adminId, 'create_security_incident', { incidentId: ref.id, incidentType })
  return { incidentId: ref.id }
})

const UPDATABLE_FIELDS = [
  'riskAssessment',
  'notificationDecision',
  'notes',
  'containedAt',
  'resolvedAt',
] as const

export const adminUpdateSecurityIncident = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { incidentId, actionTaken, ...fields } = request.data ?? {}
  if (!incidentId || typeof incidentId !== 'string') {
    throw new HttpsError('invalid-argument', 'incidentId is required.')
  }

  const ref = db.collection('securityIncidents').doc(incidentId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Incident not found.')

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  for (const key of UPDATABLE_FIELDS) {
    if (fields[key] === undefined) continue
    update[key] = key === 'containedAt' || key === 'resolvedAt' ? FieldValue.serverTimestamp() : fields[key]
  }
  if (typeof actionTaken === 'string' && actionTaken.trim()) {
    update.actionsTaken = FieldValue.arrayUnion({ note: actionTaken.trim(), at: new Date().toISOString(), by: adminId })
  }

  await ref.update(update)
  await writeAuditLog(adminId, 'update_security_incident', { incidentId, fields: Object.keys(update) })
  return { ok: true }
})
