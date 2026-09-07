import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'
import { mirrorResolvedLimits } from '../entitlements.js'

/**
 * Re-mirrors trackLimit/planTier (artist) and planTier (dj) onto every
 * existing artistProfiles/djProfiles doc. Needed once, after this deploy:
 * onArtistProfileCreate/onDjProfileCreate only fire for profiles created
 * AFTER the trigger existed — profiles created earlier (e.g. test accounts
 * from before this rollout) are stuck on whatever placeholder the client
 * wrote at creation time (trackLimit: 0) until something re-mirrors them.
 * Requires subscriptionPlans to be seeded first (adminSeedSubscriptionPlans)
 * — resolveEffectivePlan throws if no isDefaultFree plan exists for a role.
 */
export const adminBackfillEntitlements = onCall(async (request) => {
  const adminId = await requireAdmin(request)

  const [artistSnap, djSnap] = await Promise.all([
    db.collection('artistProfiles').get(),
    db.collection('djProfiles').get(),
  ])

  let artistsUpdated = 0
  let djsUpdated = 0
  const errors: string[] = []

  for (const doc of artistSnap.docs) {
    try {
      await mirrorResolvedLimits(doc.id, 'artist')
      artistsUpdated += 1
    } catch (err) {
      errors.push(`artist ${doc.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  for (const doc of djSnap.docs) {
    try {
      await mirrorResolvedLimits(doc.id, 'dj')
      djsUpdated += 1
    } catch (err) {
      errors.push(`dj ${doc.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (artistsUpdated === 0 && djsUpdated === 0 && errors.length > 0) {
    throw new HttpsError('failed-precondition', `Backfill failed for every profile — first error: ${errors[0]}`)
  }

  await writeAuditLog(adminId, 'backfill_entitlements', {
    artistsUpdated,
    djsUpdated,
    errorCount: errors.length,
  })
  return { ok: true, artistsUpdated, djsUpdated, errors: errors.slice(0, 10) }
})
