import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'
import { DEFAULT_DATA_RETENTION, type DataRetentionSettings } from '../platformSettings.js'

/** platformSettings/dataRetention is public-read/admin-write, same rule as platformSettings/default. */
export const adminUpdateDataRetentionSettings = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const input = (request.data ?? {}) as Partial<DataRetentionSettings>

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  for (const key of Object.keys(DEFAULT_DATA_RETENTION) as (keyof DataRetentionSettings)[]) {
    const value = input[key]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new HttpsError('invalid-argument', `${key} must be a positive number.`)
    }
    update[key] = value
  }

  await db.collection('platformSettings').doc('dataRetention').set(update, { merge: true })
  await writeAuditLog(adminId, 'update_data_retention_settings', update)
  return { ok: true }
})

const HOLDABLE_COLLECTIONS = ['licenceRequests', 'licenceAgreements', 'tracks'] as const

/**
 * Generalises the legalHold concept beyond the existing licenceAgreements/
 * licenceRequests fields it already reads in downloads.ts/cleanup jobs — any
 * of the three collections that carry a legalHold field can be held or
 * released here, always through an admin-only callable so the flag is never
 * client-settable and every change is audited.
 */
export const adminSetLegalHold = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { collection, docId, legalHold, reason } = request.data ?? {}
  if (!(HOLDABLE_COLLECTIONS as readonly string[]).includes(collection)) {
    throw new HttpsError('invalid-argument', `collection must be one of ${HOLDABLE_COLLECTIONS.join(', ')}.`)
  }
  if (!docId || typeof docId !== 'string') throw new HttpsError('invalid-argument', 'docId is required.')
  if (typeof legalHold !== 'boolean') throw new HttpsError('invalid-argument', 'legalHold must be a boolean.')

  const ref = db.collection(collection).doc(docId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Document not found.')

  await ref.update({ legalHold })
  await writeAuditLog(adminId, 'set_legal_hold', { collection, docId, legalHold, reason: reason ?? null })
  return { ok: true }
})
