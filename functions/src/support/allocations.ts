import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

interface AllocationInput {
  artistId: string
  amountMinor: number
}

/**
 * The only place fan support allocations are ever written. Validates the
 * requested split against the fan's actual active subscription amount
 * before writing anything — the client's numbers are a proposal, not a
 * fact, exactly per the "never trust allocation values from the client"
 * requirement. Also reconciles supportRelationships (which drive supporter
 * counts and supporter-content entitlement) to match the new allocation.
 */
export const updateSupportAllocations = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid
  const allocations = request.data?.allocations as AllocationInput[] | undefined
  if (!Array.isArray(allocations)) {
    throw new HttpsError('invalid-argument', 'allocations must be an array.')
  }

  const subSnap = await db.collection('subscriptions').doc(uid).get()
  if (!subSnap.exists || subSnap.data()?.status !== 'active') {
    throw new HttpsError('failed-precondition', 'An active subscription is required to support artists.')
  }

  const planId = subSnap.data()?.planId as string | undefined
  let capMinor = Number.POSITIVE_INFINITY
  if (planId) {
    const planSnap = await db.collection('subscriptionPlans').doc(planId).get()
    if (planSnap.exists) capMinor = planSnap.data()?.priceMinor as number
  }

  const cleaned = allocations
    .filter((a) => a && typeof a.artistId === 'string' && typeof a.amountMinor === 'number' && a.amountMinor >= 0)
    .map((a) => ({ artistId: a.artistId, amountMinor: Math.round(a.amountMinor) }))

  const total = cleaned.reduce((sum, a) => sum + a.amountMinor, 0)
  if (total > capMinor) {
    throw new HttpsError('invalid-argument', 'Total allocation exceeds your subscription amount.')
  }

  const allocationMap: Record<string, number> = {}
  for (const a of cleaned) allocationMap[a.artistId] = a.amountMinor

  const existingSnap = await db.collection('supportAllocations').doc(uid).get()
  const previousArtistIds = new Set(Object.keys((existingSnap.data()?.allocations ?? {}) as Record<string, number>))
  const nextArtistIds = new Set(Object.keys(allocationMap))

  const batch = db.batch()
  batch.set(
    db.collection('supportAllocations').doc(uid),
    { fanId: uid, allocations: allocationMap, totalMinor: total, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )

  for (const artistId of nextArtistIds) {
    if (!previousArtistIds.has(artistId)) {
      batch.set(db.collection('supportRelationships').doc(`${uid}_${artistId}`), {
        fanId: uid,
        artistId,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
  }
  for (const artistId of previousArtistIds) {
    if (!nextArtistIds.has(artistId)) {
      batch.delete(db.collection('supportRelationships').doc(`${uid}_${artistId}`))
    }
  }

  await batch.commit()
  return { ok: true, totalMinor: total }
})
