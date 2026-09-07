import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { getPlatformSettings } from '../platformSettings.js'
import { getStripe, stripeSecretKey } from '../stripe/client.js'

export const requestPayout = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const artistId = request.auth.uid

  const [accountSnap, balanceSnap, settings] = await Promise.all([
    db.collection('artistPayoutAccounts').doc(artistId).get(),
    db.collection('artistBalances').doc(artistId).get(),
    getPlatformSettings(),
  ])

  const account = accountSnap.data()
  if (!account?.stripeAccountId || !account.payoutsEnabled) {
    throw new HttpsError('failed-precondition', 'Connect a verified payout account first.')
  }

  const balance = balanceSnap.data()
  const availableMinor = (balance?.availableMinor as number) ?? 0
  if (availableMinor < settings.minimumPayoutMinor) {
    throw new HttpsError(
      'failed-precondition',
      `Available balance must be at least ${(settings.minimumPayoutMinor / 100).toFixed(2)} to request a payout.`,
    )
  }

  const currency = (balance?.currency as string) ?? 'gbp'
  const stripe = getStripe()
  const transfer = await stripe.transfers.create({
    amount: availableMinor,
    currency,
    destination: account.stripeAccountId,
    metadata: { firebaseUid: artistId },
  })

  const payoutRef = db.collection('payouts').doc()
  const batch = db.batch()
  batch.set(payoutRef, {
    payoutId: payoutRef.id,
    artistId,
    amountMinor: availableMinor,
    currency,
    stripeTransferId: transfer.id,
    status: 'paid',
    createdAt: FieldValue.serverTimestamp(),
  })
  batch.set(
    db.collection('artistBalances').doc(artistId),
    {
      availableMinor: FieldValue.increment(-availableMinor),
      paidMinor: FieldValue.increment(availableMinor),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  batch.set(db.collection('transactions').doc(`payout_${payoutRef.id}`), {
    transactionId: `payout_${payoutRef.id}`,
    type: 'payout',
    artistId,
    grossMinor: availableMinor,
    platformFeeMinor: 0,
    netMinor: -availableMinor,
    currency,
    payoutId: payoutRef.id,
    promotedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
  return { payoutId: payoutRef.id, amountMinor: availableMinor }
})
