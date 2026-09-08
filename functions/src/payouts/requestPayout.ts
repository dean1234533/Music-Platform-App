import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireActiveUser } from '../roles.js'
import { getPlatformSettings } from '../platformSettings.js'
import { getStripe, stripeSecretKey } from '../stripe/client.js'

export const requestPayout = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const artistId = request.auth.uid
  const balanceRef = db.collection('artistBalances').doc(artistId)

  const [accountSnap, settings, holdSnap] = await Promise.all([
    db.collection('artistPayoutAccounts').doc(artistId).get(),
    getPlatformSettings(),
    db.collection('payoutHolds').doc(artistId).get(),
  ])

  if (holdSnap.exists && holdSnap.data()?.active) {
    throw new HttpsError('failed-precondition', 'Payouts are on hold pending a copyright review.')
  }

  const account = accountSnap.data()
  if (!account?.stripeAccountId || !account.payoutsEnabled) {
    throw new HttpsError('failed-precondition', 'Connect a verified payout account first.')
  }

  // Reserve the payout atomically before ever calling Stripe: a double-click
  // (or two concurrent requests) must not both read the same availableMinor
  // and both create a real transfer. The transaction below checks for an
  // in-flight payout and decrements the balance in one atomic step, so a
  // second concurrent call either sees payoutInFlight=true or an
  // already-decremented balance and is rejected before Stripe is ever
  // called. If the Stripe call itself then fails, the reservation is
  // reverted below.
  const reservation = await db.runTransaction(async (tx) => {
    const balanceSnap = await tx.get(balanceRef)
    const balance = balanceSnap.data() ?? {}
    if (balance.payoutInFlight) {
      throw new HttpsError('failed-precondition', 'A payout is already being processed.')
    }
    const availableMinor = (balance.availableMinor as number) ?? 0
    if (availableMinor < settings.minimumPayoutMinor) {
      throw new HttpsError(
        'failed-precondition',
        `Available balance must be at least ${(settings.minimumPayoutMinor / 100).toFixed(2)} to request a payout.`,
      )
    }
    const currency = (balance.currency as string) ?? 'gbp'
    tx.set(
      balanceRef,
      { availableMinor: FieldValue.increment(-availableMinor), payoutInFlight: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    return { availableMinor, currency }
  })

  const { availableMinor, currency } = reservation
  const stripe = getStripe()

  let transfer
  try {
    transfer = await stripe.transfers.create({
      amount: availableMinor,
      currency,
      destination: account.stripeAccountId,
      metadata: { firebaseUid: artistId },
    })
  } catch (err) {
    // Stripe rejected the transfer — give the reserved amount back.
    await balanceRef.set(
      { availableMinor: FieldValue.increment(availableMinor), payoutInFlight: false, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    throw err
  }

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
    balanceRef,
    { paidMinor: FieldValue.increment(availableMinor), payoutInFlight: false, updatedAt: FieldValue.serverTimestamp() },
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
