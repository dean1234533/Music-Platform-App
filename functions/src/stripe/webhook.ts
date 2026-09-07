import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import type Stripe from 'stripe'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { getPlatformSettings } from '../platformSettings.js'
import { getStripe, stripeSecretKey, stripeWebhookSecret } from './client.js'
import { mapSubscriptionStatus } from '../entitlements.js'
import { writeSystemMessage } from '../messaging/messages.js'

function isFanSubscription(subscription: Stripe.Subscription): boolean {
  const role = subscription.metadata?.role
  // Pre-role subscriptions were fan subscriptions. Explicit legacy creator roles are ignored.
  return !role || role === 'fan'
}

async function findUidByCustomerId(customerId: string): Promise<string | null> {
  const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get()
  if (snap.empty) return null
  return snap.docs[0]!.id
}

async function upsertSubscriptionRecord(subscription: Stripe.Subscription) {
  if (!isFanSubscription(subscription)) {
    logger.info('Ignoring retired creator subscription', { subscriptionId: subscription.id, role: subscription.metadata?.role })
    return
  }
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const uid = subscription.metadata?.firebaseUid || (await findUidByCustomerId(customerId))
  if (!uid) {
    logger.warn('Stripe subscription has no matching Firebase user', { subscriptionId: subscription.id })
    return
  }

  const role = 'fan'
  const status = mapSubscriptionStatus(subscription.status)
  const item = subscription.items.data[0]

  await db.collection('subscriptions').doc(`${uid}_${role}`).set(
    {
      userId: uid,
      role,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      planId: subscription.metadata?.planId ?? null,
      stripePriceId: item?.price.id ?? null,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  // subscriptionStatus on users/{uid} is fan-role-only — see docs/FIRESTORE_SCHEMA.md.
  if (role === 'fan') {
    await db.collection('users').doc(uid).update({
      subscriptionStatus: status,
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.billing_reason || !['subscription_create', 'subscription_cycle', 'subscription_update'].includes(invoice.billing_reason)) {
    return
  }
  const subscriptionRole = invoice.parent?.subscription_details?.metadata?.role
  if (subscriptionRole && subscriptionRole !== 'fan') return
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return
  const uid = await findUidByCustomerId(customerId)
  if (!uid) return

  const allocationSnap = await db.collection('supportAllocations').doc(uid).get()
  if (!allocationSnap.exists) return
  const allocations = (allocationSnap.data()?.allocations ?? {}) as Record<string, number>
  const entries = Object.entries(allocations).filter(([, amount]) => amount > 0)
  if (entries.length === 0) return

  const settings = await getPlatformSettings()
  const batch = db.batch()

  for (const [artistId, artistNetMinor] of entries) {
    // Idempotency key: retried webhooks for the same invoice/artist must not double-pay.
    const txId = `${invoice.id}_${artistId}`
    const txRef = db.collection('transactions').doc(txId)
    const existing = await txRef.get()
    if (existing.exists) continue

    const grossMinor = settings.artistAllocationPercent > 0
      ? Math.round(artistNetMinor / (settings.artistAllocationPercent / 100))
      : 0
    const netMinor = artistNetMinor
    const platformFeeMinor = Math.max(0, grossMinor - netMinor)

    batch.set(txRef, {
      transactionId: txId,
      type: 'subscription_income',
      artistId,
      fanId: uid,
      grossMinor,
      platformFeeMinor,
      netMinor,
      currency: invoice.currency,
      stripeInvoiceId: invoice.id,
      promotedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    })

    const balanceRef = db.collection('artistBalances').doc(artistId)
    batch.set(
      balanceRef,
      {
        artistId,
        pendingMinor: FieldValue.increment(netMinor),
        currency: invoice.currency,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }

  await batch.commit()
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return
  const uid = await findUidByCustomerId(customerId)
  if (!uid) return

  await db.collection('users').doc(uid).update({
    subscriptionStatus: 'past_due',
    updatedAt: FieldValue.serverTimestamp(),
  })

  await db.collection('notifications').add({
    userId: uid,
    type: 'payment_required',
    title: 'Payment failed',
    body: 'Your subscription payment failed. Update your payment method to keep supporting your artists.',
    linkTo: '/app/subscription',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'payment' || session.metadata?.kind !== 'licence_payment') return
  const agreementId = session.metadata?.agreementId
  if (!agreementId) return

  const agreementRef = db.collection('licenceAgreements').doc(agreementId)
  const snap = await agreementRef.get()
  if (!snap.exists || snap.data()?.paidAt) return
  const agreement = snap.data()!

  const grossMinor = agreement.licenceFeeMinor as number
  const platformFeeMinor = typeof agreement.platformFeeMinor === 'number'
    ? agreement.platformFeeMinor
    : Math.round(grossMinor * ((await getPlatformSettings()).djServiceFeePercent / 100))
  const netMinor = typeof agreement.artistNetMinor === 'number' ? agreement.artistNetMinor : grossMinor - platformFeeMinor
  const txId = `licence_${agreementId}`

  const requestRef = db.collection('licenceRequests').doc(agreement.licenceRequestId)
  const requestSnap = await requestRef.get()
  const conversationRef = requestSnap.exists
    ? db.collection('conversations').doc(requestSnap.data()!.conversationId as string)
    : null

  const batch = db.batch()
  batch.update(agreementRef, { paidAt: FieldValue.serverTimestamp(), status: 'active' })
  batch.update(requestRef, {
    status: 'approved',
    updatedAt: FieldValue.serverTimestamp(),
  })
  if (conversationRef) {
    writeSystemMessage(batch, conversationRef, agreement.djId, 'payment_status', 'Payment completed — track access unlocked.', {
      agreementId,
    })
  }
  batch.set(db.collection('transactions').doc(txId), {
    transactionId: txId,
    type: 'dj_licence_income',
    artistId: agreement.artistId,
    djId: agreement.djId,
    agreementId,
    grossMinor,
    platformFeeMinor,
    netMinor,
    currency: agreement.currency,
    stripeCheckoutSessionId: session.id,
    promotedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  })
  batch.set(
    db.collection('artistBalances').doc(agreement.artistId),
    {
      artistId: agreement.artistId,
      pendingMinor: FieldValue.increment(netMinor),
      currency: agreement.currency,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  batch.set(db.collection('notifications').doc(), {
    userId: agreement.djId,
    type: 'download_unlocked',
    title: 'Payment received — download unlocked',
    body: 'Your licence payment was received. The full-quality track is now available.',
    linkTo: '/dj/requests',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })
  batch.set(db.collection('notifications').doc(), {
    userId: agreement.artistId,
    type: 'dj_licence_payment',
    title: 'DJ licence paid',
    body: 'A DJ completed payment for their licence.',
    linkTo: '/dashboard/artist/revenue',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
}

export const stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
  const signature = req.headers['stripe-signature']
  if (!signature || typeof signature !== 'string') {
    res.status(400).send('Missing signature')
    return
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret.value())
  } catch (err) {
    logger.error('Stripe webhook signature verification failed', err)
    res.status(400).send('Invalid signature')
    return
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertSubscriptionRecord(event.data.object as Stripe.Subscription)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as Stripe.Invoice)
        break
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      default:
        break
    }
    res.status(200).send('ok')
  } catch (err) {
    logger.error('Stripe webhook handler error', err)
    res.status(500).send('Internal error')
  }
})
