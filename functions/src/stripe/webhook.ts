import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import type Stripe from 'stripe'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { getPlatformSettings } from '../platformSettings.js'
import { getStripe, stripeSecretKey, stripeWebhookSecret } from './client.js'
import { mapSubscriptionStatus } from '../entitlements.js'
import { writeRequestEvent } from '../licensing/events.js'

const SUPPORTED_SUBSCRIPTION_ROLES = new Set(['fan', 'artist'])

function subscriptionRoleOf(subscription: Stripe.Subscription): 'fan' | 'artist' | null {
  const role = subscription.metadata?.role
  // Pre-role subscriptions were fan subscriptions. Explicit legacy creator roles are ignored.
  if (!role) return 'fan'
  return SUPPORTED_SUBSCRIPTION_ROLES.has(role) ? (role as 'fan' | 'artist') : null
}

async function findUidByCustomerId(customerId: string): Promise<string | null> {
  const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get()
  if (snap.empty) return null
  return snap.docs[0]!.id
}

interface NetRevenue {
  customerPaidMinor: number
  taxMinor: number
  processingFeeMinor: number
  netRevenueMinor: number
}

function calculateNetRevenue(customerPaidMinor: number, taxMinor: number, processingFeeMinor: number): NetRevenue {
  const paid = Math.max(0, Math.round(customerPaidMinor))
  const tax = Math.min(paid, Math.max(0, Math.round(taxMinor)))
  const processingFee = Math.min(paid - tax, Math.max(0, Math.round(processingFeeMinor)))
  return {
    customerPaidMinor: paid,
    taxMinor: tax,
    processingFeeMinor: processingFee,
    netRevenueMinor: paid - tax - processingFee,
  }
}

async function processingFeeForPaymentIntent(paymentIntent: string | Stripe.PaymentIntent): Promise<number> {
  const stripe = getStripe()
  const intent = typeof paymentIntent === 'string'
    ? await stripe.paymentIntents.retrieve(paymentIntent, { expand: ['latest_charge.balance_transaction'] })
    : paymentIntent
  const latestCharge = intent.latest_charge
  if (!latestCharge) return 0
  const charge = typeof latestCharge === 'string'
    ? await stripe.charges.retrieve(latestCharge, { expand: ['balance_transaction'] })
    : latestCharge
  const balanceTransaction = charge.balance_transaction
  if (!balanceTransaction) return 0
  const resolved = typeof balanceTransaction === 'string'
    ? await stripe.balanceTransactions.retrieve(balanceTransaction)
    : balanceTransaction
  return resolved.fee
}

async function paymentDetailsForInvoice(invoiceId: string): Promise<{ processingFeeMinor: number; paymentIntentIds: string[] }> {
  const payments = await getStripe().invoicePayments.list({ invoice: invoiceId, status: 'paid', limit: 20 })
  let total = 0
  const paymentIntentIds: string[] = []
  for (const invoicePayment of payments.data) {
    if (invoicePayment.payment.payment_intent) {
      const paymentIntent = invoicePayment.payment.payment_intent
      paymentIntentIds.push(typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id)
      total += await processingFeeForPaymentIntent(paymentIntent)
    } else if (invoicePayment.payment.charge) {
      const charge = typeof invoicePayment.payment.charge === 'string'
        ? await getStripe().charges.retrieve(invoicePayment.payment.charge, { expand: ['balance_transaction'] })
        : invoicePayment.payment.charge
      const balanceTransaction = charge.balance_transaction
      if (balanceTransaction) {
        const resolved = typeof balanceTransaction === 'string'
          ? await getStripe().balanceTransactions.retrieve(balanceTransaction)
          : balanceTransaction
        total += resolved.fee
      }
    }
  }
  return { processingFeeMinor: total, paymentIntentIds }
}

async function upsertSubscriptionRecord(subscription: Stripe.Subscription) {
  const role = subscriptionRoleOf(subscription)
  if (!role) {
    logger.info('Ignoring retired creator subscription', { subscriptionId: subscription.id, role: subscription.metadata?.role })
    return
  }
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const uid = subscription.metadata?.firebaseUid || (await findUidByCustomerId(customerId))
  if (!uid) {
    logger.warn('Stripe subscription has no matching Firebase user', { subscriptionId: subscription.id })
    return
  }

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

  // Denormalized per-role status fields on users/{uid} — see docs/FIRESTORE_SCHEMA.md.
  const statusField = role === 'fan' ? 'subscriptionStatus' : 'artistMembershipStatus'
  await db.collection('users').doc(uid).update({
    [statusField]: status,
    updatedAt: FieldValue.serverTimestamp(),
  })
}

/**
 * Artist Membership income doesn't get split to any artist — it's straight
 * platform revenue, so this just records the accounting entry (matching the
 * `transactions` pattern every other payment type already writes into) with
 * no artist-balance credit. Idempotent on invoice.id like the other handlers.
 */
async function recordArtistMembershipIncome(invoice: Stripe.Invoice, uid: string) {
  const txId = `artist_membership_${invoice.id}`
  const existing = await db.collection('transactions').doc(txId).get()
  if (existing.exists) return

  const totalTaxMinor = Math.max(0, invoice.total - (invoice.total_excluding_tax ?? invoice.total))
  const { processingFeeMinor, paymentIntentIds } = await paymentDetailsForInvoice(invoice.id)
  const settlement = calculateNetRevenue(invoice.amount_paid, totalTaxMinor, processingFeeMinor)

  await db.collection('transactions').doc(txId).set({
    transactionId: txId,
    type: 'artist_membership_income',
    artistId: uid,
    grossMinor: settlement.customerPaidMinor,
    platformFeeMinor: 0,
    netMinor: settlement.netRevenueMinor,
    currency: invoice.currency,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: paymentIntentIds[0] ?? null,
    stripePaymentIntentIds: paymentIntentIds,
    revenueBasis: 'net_after_tax_and_processing',
    promotedAt: null,
    refundedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.billing_reason || !['subscription_create', 'subscription_cycle', 'subscription_update'].includes(invoice.billing_reason)) {
    return
  }
  const subscriptionRole = invoice.parent?.subscription_details?.metadata?.role
  if (subscriptionRole && !SUPPORTED_SUBSCRIPTION_ROLES.has(subscriptionRole)) return
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return
  const uid = await findUidByCustomerId(customerId)
  if (!uid) return

  if (subscriptionRole === 'artist') {
    await recordArtistMembershipIncome(invoice, uid)
    return
  }

  const allocationSnap = await db.collection('supportAllocations').doc(uid).get()
  if (!allocationSnap.exists) return
  const allocations = (allocationSnap.data()?.allocations ?? {}) as Record<string, number>
  const entries = Object.entries(allocations).filter(([, amount]) => amount > 0)
  if (entries.length === 0) return

  const settings = await getPlatformSettings()
  const subscriptionSnap = await db.collection('subscriptions').doc(`${uid}_fan`).get()
  const planId = subscriptionSnap.data()?.planId as string | undefined
  if (!planId) throw new Error(`Paid invoice ${invoice.id} has no subscription plan.`)
  const planSnap = await db.collection('subscriptionPlans').doc(planId).get()
  if (!planSnap.exists) throw new Error(`Paid invoice ${invoice.id} references missing plan ${planId}.`)
  const planPriceMinor = planSnap.data()!.priceMinor as number
  const configuredArtistPoolMinor = Math.round(planPriceMinor * (settings.artistAllocationPercent / 100))
  if (configuredArtistPoolMinor <= 0) throw new Error(`Plan ${planId} has no artist allocation.`)

  const totalTaxMinor = Math.max(0, invoice.total - (invoice.total_excluding_tax ?? invoice.total))
  const { processingFeeMinor, paymentIntentIds } = await paymentDetailsForInvoice(invoice.id)
  const settlement = calculateNetRevenue(invoice.amount_paid, totalTaxMinor, processingFeeMinor)
  const artistPoolMinor = Math.round(settlement.netRevenueMinor * (settings.artistAllocationPercent / 100))
  const settlementRef = db.collection('billingSettlements').doc(invoice.id)

  await db.runTransaction(async (tx) => {
    const existingSettlement = await tx.get(settlementRef)
    if (existingSettlement.exists) return

    let allocatedToArtistsMinor = 0
    for (const [artistId, requestedAllocationMinor] of entries) {
      const allocationRatio = Math.min(1, requestedAllocationMinor / configuredArtistPoolMinor)
      const grossMinor = Math.round(settlement.netRevenueMinor * allocationRatio)
      const netMinor = Math.round(artistPoolMinor * allocationRatio)
      const platformFeeMinor = Math.max(0, grossMinor - netMinor)
      allocatedToArtistsMinor += netMinor
      const txId = `${invoice.id}_${artistId}`

      tx.set(db.collection('transactions').doc(txId), {
        transactionId: txId,
        type: 'subscription_income',
        artistId,
        fanId: uid,
        grossMinor,
        platformFeeMinor,
        netMinor,
        currency: invoice.currency,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: paymentIntentIds[0] ?? null,
        stripePaymentIntentIds: paymentIntentIds,
        revenueBasis: 'net_after_tax_and_processing',
        promotedAt: null,
        refundedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      })

      tx.set(
        db.collection('artistBalances').doc(artistId),
        {
          artistId,
          pendingMinor: FieldValue.increment(netMinor),
          currency: invoice.currency,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    }

    tx.set(settlementRef, {
      settlementId: invoice.id,
      type: 'supporter_subscription',
      userId: uid,
      planId,
      ...settlement,
      platformFeePercent: settings.platformFeePercent,
      artistAllocationPercent: settings.artistAllocationPercent,
      artistPoolMinor,
      allocatedToArtistsMinor,
      unallocatedArtistPoolMinor: Math.max(0, artistPoolMinor - allocatedToArtistsMinor),
      platformRevenueMinor: Math.max(0, settlement.netRevenueMinor - allocatedToArtistsMinor),
      currency: invoice.currency,
      stripePaymentIntentIds: paymentIntentIds,
      createdAt: FieldValue.serverTimestamp(),
    })
  })
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return
  const uid = await findUidByCustomerId(customerId)
  if (!uid) return

  const subscriptionRole = invoice.parent?.subscription_details?.metadata?.role
  const isArtist = subscriptionRole === 'artist'
  const statusField = isArtist ? 'artistMembershipStatus' : 'subscriptionStatus'

  await db.collection('users').doc(uid).update({
    [statusField]: 'past_due',
    updatedAt: FieldValue.serverTimestamp(),
  })

  await db.collection('notifications').add({
    userId: uid,
    type: 'payment_required',
    title: 'Payment failed',
    body: isArtist
      ? 'Your Artist Membership payment failed. Update your payment method to keep publishing music.'
      : 'Your subscription payment failed. Update your payment method to keep supporting your artists.',
    linkTo: isArtist ? '/dashboard/artist/settings' : '/app/subscription',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  })
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'payment' || session.metadata?.kind !== 'licence_payment') return
  const agreementId = session.metadata?.agreementId
  if (!agreementId) return

  const agreementRef = db.collection('licenceAgreements').doc(agreementId)
  const paymentIntent = session.payment_intent
  if (!paymentIntent) throw new Error(`Licence checkout ${session.id} has no payment intent.`)
  const settings = await getPlatformSettings()
  const processingFeeMinor = await processingFeeForPaymentIntent(paymentIntent)
  const customerPaidMinor = session.amount_total ?? 0
  const taxMinor = session.total_details?.amount_tax ?? 0
  const settlement = calculateNetRevenue(customerPaidMinor, taxMinor, processingFeeMinor)
  const platformFeeMinor = Math.round(settlement.netRevenueMinor * (settings.djServiceFeePercent / 100))
  const netMinor = settlement.netRevenueMinor - platformFeeMinor

  // The whole read-check-write must be one Firestore transaction: two
  // concurrent deliveries of the same event (Stripe explicitly documents
  // "at least once" delivery, and retries can overlap) must not both read
  // paidAt as null and both credit the artist's balance. A transaction
  // serializes conflicting operations on agreementRef, so the second
  // delivery's read happens only after the first's write commits.
  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(agreementRef)
    if (!snap.exists || snap.data()?.paidAt) return null
    const agreement = snap.data()!

    const requestRef = db.collection('licenceRequests').doc(agreement.licenceRequestId)

    const grossMinor = settlement.netRevenueMinor
    const txId = `licence_${agreementId}`
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

    tx.update(agreementRef, {
      paidAt: FieldValue.serverTimestamp(),
      status: 'active',
      customerPaidMinor: settlement.customerPaidMinor,
      taxMinor: settlement.taxMinor,
      processingFeeMinor: settlement.processingFeeMinor,
      netRevenueMinor: settlement.netRevenueMinor,
      platformFeePercent: settings.djServiceFeePercent,
      platformFeeMinor,
      artistNetMinor: netMinor,
      revenueBasis: 'net_after_tax_and_processing',
    })
    tx.update(requestRef, { status: 'approved', updatedAt: FieldValue.serverTimestamp() })
    writeRequestEvent(tx, requestRef, {
      type: 'payment_completed',
      actorId: null,
      actorRole: 'system',
      summary: 'Payment completed. The licence is active and the track is ready to download.',
      agreementId,
    })
    tx.set(db.collection('transactions').doc(txId), {
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
      stripePaymentIntentId: paymentIntentId,
      customerPaidMinor: settlement.customerPaidMinor,
      taxMinor: settlement.taxMinor,
      processingFeeMinor: settlement.processingFeeMinor,
      revenueBasis: 'net_after_tax_and_processing',
      promotedAt: null,
      refundedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.set(
      db.collection('artistBalances').doc(agreement.artistId),
      {
        artistId: agreement.artistId,
        pendingMinor: FieldValue.increment(netMinor),
        currency: agreement.currency,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    tx.set(db.collection('notifications').doc(), {
      userId: agreement.djId,
      type: 'download_unlocked',
      title: 'Payment received — download unlocked',
      body: 'Your licence payment was received. The full-quality track is now available.',
      linkTo: `/agreements/${agreementId}`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.set(db.collection('notifications').doc(), {
      userId: agreement.artistId,
      type: 'dj_licence_payment',
      title: 'DJ licence paid',
      body: 'A DJ completed payment for their licence.',
      linkTo: '/dashboard/artist/revenue',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
    return { ok: true }
  })

  if (!outcome) {
    logger.info('checkout.session.completed: agreement missing or already paid — no-op', { agreementId })
  }
}

/**
 * Reverses the corresponding share of an artist-balance credit for a
 * partially or fully refunded charge. Matches payment intents for both
 * supporter subscriptions and DJ licence payments. Reverses from pendingMinor first, then
 * availableMinor; if the funds have already been paid out (moved to
 * paidMinor), automatic reversal would push a balance negative for money
 * that already left the platform, so that case is flagged for manual admin
 * reconciliation instead of silently mutating a paid-out balance.
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const matches = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (paymentIntentId) {
    const snap = await db.collection('transactions').where('stripePaymentIntentId', '==', paymentIntentId).get()
    for (const doc of snap.docs) matches.set(doc.id, doc)
    const multiSnap = await db.collection('transactions').where('stripePaymentIntentIds', 'array-contains', paymentIntentId).get()
    for (const doc of multiSnap.docs) matches.set(doc.id, doc)
  }

  for (const doc of matches.values()) {
    const balanceRef = db.collection('artistBalances').doc(doc.data().artistId as string)
    await db.runTransaction(async (tx) => {
      const [txSnap, balanceSnap] = await Promise.all([tx.get(doc.ref), tx.get(balanceRef)])
      const data = txSnap.data()
      if (!data) return
      const netMinor = data.netMinor as number
      const previousCustomerRefundedMinor = (data.refundedCustomerMinor as number) ?? 0
      const newlyRefundedCustomerMinor = Math.max(0, charge.amount_refunded - previousCustomerRefundedMinor)
      if (newlyRefundedCustomerMinor === 0) return
      const refundedMinor = Math.min(
        netMinor - ((data.refundedMinor as number) ?? 0),
        Math.round(netMinor * (newlyRefundedCustomerMinor / charge.amount)),
      )
      if (refundedMinor <= 0) return
      const balance = balanceSnap.data() ?? {}
      const pending = (balance.pendingMinor as number) ?? 0
      const available = (balance.availableMinor as number) ?? 0

      tx.update(doc.ref, {
        refundedAt: charge.refunded ? FieldValue.serverTimestamp() : null,
        refundedCustomerMinor: charge.amount_refunded,
        refundedMinor: FieldValue.increment(refundedMinor),
      })

      if (pending >= refundedMinor) {
        tx.set(balanceRef, { pendingMinor: FieldValue.increment(-refundedMinor), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      } else if (available >= refundedMinor) {
        tx.set(balanceRef, { availableMinor: FieldValue.increment(-refundedMinor), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      } else {
        tx.set(db.collection('auditLogs').doc(), {
          adminId: 'system',
          action: 'refund_requires_manual_reconciliation',
          details: { transactionId: doc.id, artistId: data.artistId, refundedMinor, reason: 'funds already promoted/paid out' },
          createdAt: FieldValue.serverTimestamp(),
        })
      }
    })
  }
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
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
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
