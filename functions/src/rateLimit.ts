import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { db } from './admin.js'

/**
 * Simple fixed-window rate limiter backed by Firestore, for abuse-prone
 * callables that have no other volume control (chat, DJ requests, copyright
 * claims, anonymous preview-play counting). Not a substitute for Cloudflare-
 * level HTTP rate limiting or Firebase App Check — those act before a
 * request ever reaches this code and should be configured for the deployed
 * domain (see SECURITY_AUDIT.md). This exists to bound cost/spam even
 * without those layers, and keeps working regardless of how the request
 * reached the callable.
 *
 * `rateLimits/{key}` docs are Cloud-Function-only (firestore.rules denies
 * all client access) since the key can embed a uid and the count itself
 * isn't meaningful to expose.
 */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const ref = db.collection('rateLimits').doc(key)
  const now = Date.now()

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.data()
    const windowStart = data?.windowStart as number | undefined
    const count = (data?.count as number | undefined) ?? 0

    if (windowStart && now - windowStart < windowSeconds * 1000) {
      if (count >= limit) {
        throw new HttpsError('resource-exhausted', 'Too many requests — please slow down and try again shortly.')
      }
      tx.set(ref, { count: FieldValue.increment(1) }, { merge: true })
    } else {
      tx.set(ref, { windowStart: now, count: 1 })
    }
  })
}
