import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

const CLEARING_PERIOD_DAYS = 7

/**
 * Daily job moving income older than the clearing period from "pending" to
 * "available" on each artist's balance, so the pending/available/paid
 * distinction shown in the Revenue dashboard reflects something real rather
 * than being available the instant a payment lands.
 */
export const promotePendingBalances = onSchedule('every 24 hours', async () => {
  const cutoff = new Date(Date.now() - CLEARING_PERIOD_DAYS * 24 * 60 * 60 * 1000)

  const snap = await db
    .collection('transactions')
    .where('promotedAt', '==', null)
    .where('createdAt', '<=', cutoff)
    .limit(200)
    .get()

  if (snap.empty) return

  const batch = db.batch()
  for (const doc of snap.docs) {
    const data = doc.data()
    if (!['subscription_income', 'dj_licence_income'].includes(data.type)) continue
    batch.update(doc.ref, { promotedAt: FieldValue.serverTimestamp() })
    batch.set(
      db.collection('artistBalances').doc(data.artistId),
      {
        pendingMinor: FieldValue.increment(-data.netMinor),
        availableMinor: FieldValue.increment(data.netMinor),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }
  await batch.commit()
})
