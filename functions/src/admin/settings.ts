import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'
import { PLAN_FEATURE_KEYS, PLAN_LIMIT_KEYS, PLAN_ROLES, PLAN_TIERS } from '../entitlements.js'

/** subscriptionPlans and platformSettings are admin-write-only in Firestore rules — these callables are the only path in. */
export const adminUpsertSubscriptionPlan = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const {
    planId,
    name,
    role,
    tier,
    priceMinor,
    currency,
    interval,
    active,
    isDefaultFree,
    stripePriceId,
    features,
    limits,
    displayOrder,
    recommended,
  } = request.data ?? {}

  if (!planId || !name || typeof priceMinor !== 'number' || !currency || !interval) {
    throw new HttpsError('invalid-argument', 'planId, name, priceMinor, currency, and interval are required.')
  }
  if (interval !== 'month' && interval !== 'year') {
    throw new HttpsError('invalid-argument', 'interval must be "month" or "year".')
  }
  if (!(PLAN_ROLES as readonly string[]).includes(role)) {
    throw new HttpsError('invalid-argument', `role must be one of ${PLAN_ROLES.join(', ')}.`)
  }
  if (!(PLAN_TIERS as readonly string[]).includes(tier)) {
    throw new HttpsError('invalid-argument', `tier must be one of ${PLAN_TIERS.join(', ')}.`)
  }
  // A paid plan needs real billing wired up; a free plan has none to wire.
  if (priceMinor > 0 && !stripePriceId) {
    throw new HttpsError('invalid-argument', 'stripePriceId is required for a plan with priceMinor > 0.')
  }

  const cleanedFeatures: Record<string, boolean> = {}
  if (features && typeof features === 'object') {
    for (const key of PLAN_FEATURE_KEYS) {
      if (typeof features[key] === 'boolean') cleanedFeatures[key] = features[key]
    }
  }
  const cleanedLimits: Record<string, number> = {}
  if (limits && typeof limits === 'object') {
    for (const key of PLAN_LIMIT_KEYS) {
      if (typeof limits[key] === 'number') cleanedLimits[key] = limits[key]
    }
  }

  await db.collection('subscriptionPlans').doc(planId).set(
    {
      planId,
      name,
      role,
      tier,
      priceMinor,
      currency,
      interval,
      stripePriceId: priceMinor > 0 ? stripePriceId : null,
      active: active !== false,
      isDefaultFree: isDefaultFree === true,
      features: cleanedFeatures,
      limits: cleanedLimits,
      displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
      recommended: recommended === true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  await writeAuditLog(adminId, 'upsert_subscription_plan', { planId, name, role, tier, priceMinor, currency, interval, active })
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
