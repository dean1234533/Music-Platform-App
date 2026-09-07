import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'

/** subscriptionPlans and platformSettings are admin-write-only in Firestore rules — these callables are the only path in. */
export const adminUpsertSubscriptionPlan = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const { planId, name, priceMinor, currency, interval, active, stripePriceId } = request.data ?? {}
  if (!planId || !name || typeof priceMinor !== 'number' || !currency || !interval || !stripePriceId) {
    throw new HttpsError('invalid-argument', 'planId, name, priceMinor, currency, interval, and stripePriceId are required.')
  }
  if (interval !== 'month' && interval !== 'year') {
    throw new HttpsError('invalid-argument', 'interval must be "month" or "year".')
  }

  await db.collection('subscriptionPlans').doc(planId).set(
    {
      planId,
      name,
      priceMinor,
      currency,
      interval,
      stripePriceId,
      active: active !== false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  await writeAuditLog(adminId, 'upsert_subscription_plan', { planId, name, priceMinor, currency, interval, active })
  return { ok: true }
})

export const adminUpdatePlatformSettings = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const {
    platformFeePercent,
    artistAllocationPercent,
    djServiceFeePercent,
    minimumPayoutMinor,
    allowedPreviewDurationsSec,
    maxUploadSizeMB,
    supportedAudioTypes,
  } = request.data ?? {}

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  if (typeof platformFeePercent === 'number') update.platformFeePercent = platformFeePercent
  if (typeof artistAllocationPercent === 'number') update.artistAllocationPercent = artistAllocationPercent
  if (typeof djServiceFeePercent === 'number') update.djServiceFeePercent = djServiceFeePercent
  if (typeof minimumPayoutMinor === 'number') update.minimumPayoutMinor = minimumPayoutMinor
  if (Array.isArray(allowedPreviewDurationsSec)) update.allowedPreviewDurationsSec = allowedPreviewDurationsSec
  if (typeof maxUploadSizeMB === 'number') update.maxUploadSizeMB = maxUploadSizeMB
  if (Array.isArray(supportedAudioTypes)) update.supportedAudioTypes = supportedAudioTypes

  await db.collection('platformSettings').doc('default').set(update, { merge: true })
  await writeAuditLog(adminId, 'update_platform_settings', update)
  return { ok: true }
})
