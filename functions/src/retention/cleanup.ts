import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { db } from '../admin.js'
import { getDataRetentionSettings } from '../platformSettings.js'

/** A stale, never-finalised negotiation is a fixed housekeeping window, not an admin-configurable retention period. */
const STALE_NEGOTIATION_DAYS = 90

const NEGOTIABLE_REQUEST_STATUSES = [
  'submitted',
  'negotiating',
  'offer_sent',
  'counter_offer',
  'agreement_ready',
  'awaiting_payment',
]
const IMPORTANT_NOTIFICATION_TYPES = ['payment_required', 'agreement_ready', 'download_unlocked', 'copyright_claim_update']

function cutoffDaysAgo(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000)
}

async function deleteSubcollectionBatched(parentPath: string, subcollection: string, batchSize = 300): Promise<void> {
  for (;;) {
    const snap = await db.collection(`${parentPath}/${subcollection}`).limit(batchSize).get()
    if (snap.empty) return
    const batch = db.batch()
    for (const doc of snap.docs) batch.delete(doc.ref)
    await batch.commit()
    if (snap.size < batchSize) return
  }
}

async function deleteStorageFile(path: string | null | undefined): Promise<void> {
  if (!path) return
  try {
    await getStorage().bucket().file(path).delete()
  } catch {
    // Already gone — fine.
  }
}

async function processInBatches<T extends QueryDocumentSnapshot>(
  query: Query,
  handle: (doc: T) => Promise<void>,
  batchLimit = 200,
): Promise<void> {
  const snap = await query.limit(batchLimit).get()
  await Promise.all(snap.docs.map((doc) => handle(doc as T)))
}

/**
 * A Story past its recovery window (expiresAt + storyRecoveryDays) is gone
 * from feeds already — this is the physical deletion of the doc and media.
 * Highlights are exempt entirely, matching the "unless saved as a Highlight"
 * carve-out in the spec.
 */
export const expireStories = onSchedule('every 24 hours', async () => {
  const { storyRecoveryDays } = await getDataRetentionSettings()
  const cutoff = cutoffDaysAgo(storyRecoveryDays)

  await processInBatches(
    db.collection('stories').where('isHighlight', '==', false).where('expiresAt', '<=', cutoff),
    async (doc) => {
      await deleteStorageFile(doc.data().mediaStoragePath as string | null | undefined)
      await doc.ref.delete()
    },
  )
})

export const cleanupOldNotifications = onSchedule('every 24 hours', async () => {
  const { notificationsDays } = await getDataRetentionSettings()
  const longCutoff = cutoffDaysAgo(notificationsDays * 3)
  const shortCutoff = cutoffDaysAgo(notificationsDays)

  await processInBatches(db.collection('notifications').where('createdAt', '<=', longCutoff), async (doc) => {
    const data = doc.data()
    const cutoff = IMPORTANT_NOTIFICATION_TYPES.includes(data.type) ? longCutoff : shortCutoff
    const createdAt = data.createdAt as Timestamp | null
    if (createdAt && createdAt.toMillis() <= cutoff.toMillis()) {
      await doc.ref.delete()
    }
  })
})

/** Deletes an abandoned request's conversation thread along with it — there is no contract to preserve. */
async function deleteRequestAndConversation(requestDoc: QueryDocumentSnapshot): Promise<void> {
  const request = requestDoc.data()
  if (request.legalHold) return
  const conversationId = request.conversationId as string | undefined
  if (conversationId) {
    await deleteSubcollectionBatched(`conversations/${conversationId}`, 'messages')
    await db.collection('conversations').doc(conversationId).delete()
  }
  await requestDoc.ref.delete()
}

export const cleanupAbandonedRequests = onSchedule('every 24 hours', async () => {
  const { abandonedRequestMonths } = await getDataRetentionSettings()
  const cutoff = cutoffDaysAgo(abandonedRequestMonths * 30)

  await processInBatches(
    db.collection('licenceRequests').where('status', 'in', ['rejected', 'cancelled', 'expired']).where('updatedAt', '<=', cutoff),
    deleteRequestAndConversation,
  )
})

export const cleanupExpiredDraftOffers = onSchedule('every 24 hours', async () => {
  const { draftOfferMonths } = await getDataRetentionSettings()
  const cutoff = cutoffDaysAgo(draftOfferMonths * 30)

  await processInBatches(
    db
      .collection('licenceOffers')
      .where('status', 'in', ['withdrawn', 'countered', 'rejected', 'expired'])
      .where('createdAt', '<=', cutoff),
    async (doc) => {
      await doc.ref.delete()
    },
  )
})

/** A conversation is only deletable once its request is no longer negotiable and carries no active/signed agreement. */
export const cleanupInactiveChats = onSchedule('every 24 hours', async () => {
  const { inactiveChatMonths } = await getDataRetentionSettings()
  const cutoff = cutoffDaysAgo(inactiveChatMonths * 30)

  await processInBatches(db.collection('conversations').where('lastMessageAt', '<=', cutoff), async (doc) => {
    const conversation = doc.data()
    const requestId = conversation.licenceRequestId as string | undefined
    if (requestId) {
      const requestSnap = await db.collection('licenceRequests').doc(requestId).get()
      if (requestSnap.exists) {
        const request = requestSnap.data()!
        if (request.legalHold) return
        if (NEGOTIABLE_REQUEST_STATUSES.includes(request.status) || request.status === 'approved') return
      }
    }
    await deleteSubcollectionBatched(`conversations/${doc.id}`, 'messages')
    await doc.ref.delete()
  })
})

/**
 * Requests/offers/agreements that have sat unresolved past a fixed window
 * time out to 'expired' rather than staying open forever — closes the gap
 * where nothing in the codebase ever produced that status.
 */
export const expireStaleNegotiations = onSchedule('every 24 hours', async () => {
  const cutoff = cutoffDaysAgo(STALE_NEGOTIATION_DAYS)

  await processInBatches(
    db.collection('licenceRequests').where('status', 'in', NEGOTIABLE_REQUEST_STATUSES).where('updatedAt', '<=', cutoff),
    async (doc) => {
      const request = doc.data()
      if (request.legalHold) return
      await doc.ref.update({ status: 'expired', updatedAt: FieldValue.serverTimestamp() })
      if (request.currentAgreementId) {
        const agreementRef = db.collection('licenceAgreements').doc(request.currentAgreementId)
        const agreementSnap = await agreementRef.get()
        if (agreementSnap.exists && agreementSnap.data()!.status === 'pending' && !agreementSnap.data()!.legalHold) {
          await agreementRef.update({ status: 'expired' })
        }
      }
      if (request.currentOfferId) {
        const offerRef = db.collection('licenceOffers').doc(request.currentOfferId)
        const offerSnap = await offerRef.get()
        if (offerSnap.exists && offerSnap.data()!.status === 'pending') {
          await offerRef.update({ status: 'expired' })
        }
      }
    },
  )
})

/**
 * A finalised (signed, rejected, or otherwise resolved) contract is kept for
 * `contractYears` after it was finalised — the accounting/legal-claim
 * retention window — then its record (and the download logs/acceptance
 * logs tied to it) is removed, unless under legal hold.
 */
/**
 * A contract's own licence duration (expiryDate) lapsing is distinct from the
 * multi-year retention window above: this flips status active -> expired the
 * day after the licence period ends and notifies both parties, so "Expired"
 * on the My Agreements page and getSecureDownloadUrl's live expiry check
 * (functions/src/licensing/downloads.ts) agree with the record everyone sees.
 */
export const expireActiveContracts = onSchedule('every 24 hours', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const snap = await db.collection('licenceAgreements').where('status', '==', 'active').get()
  const batch = db.batch()
  let writes = 0
  for (const doc of snap.docs) {
    const agreement = doc.data()
    if (!agreement.expiryDate || agreement.expiryDate >= today) continue
    batch.update(doc.ref, { status: 'expired' })
    for (const userId of [agreement.artistId, agreement.djId]) {
      batch.set(db.collection('notifications').doc(), {
        userId,
        type: 'contract_expired',
        title: 'Licence expired',
        body: 'The licence period on this agreement has ended.',
        linkTo: `/agreements/${doc.id}`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
    writes += 1
    if (writes >= 150) break // stay well under the 500-write batch limit (3 writes per agreement)
  }
  if (writes > 0) await batch.commit()
})

export const cleanupExpiredContracts = onSchedule('every 24 hours', async () => {
  const { contractYears } = await getDataRetentionSettings()
  const cutoff = cutoffDaysAgo(contractYears * 365)

  await processInBatches(
    db.collection('licenceAgreements').where('finalisedAt', '<=', cutoff),
    async (doc) => {
      const agreement = doc.data()
      if (agreement.legalHold) return
      if (agreement.status === 'active') return // still in force — not "ended" yet
      await deleteQueryBatched(db.collection('downloadLogs').where('agreementId', '==', doc.id))
      await deleteQueryBatched(db.collection('licenceAgreementAcceptances').where('agreementId', '==', doc.id))
      await doc.ref.delete()
    },
    500,
  )
})

async function deleteQueryBatched(query: Query, batchSize = 300): Promise<void> {
  for (;;) {
    const snap = await query.limit(batchSize).get()
    if (snap.empty) return
    const batch = db.batch()
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()
    if (snap.size < batchSize) return
  }
}

/** Anonymises the claimant's personal details on old, finally-resolved copyright claims — the decision record stays. */
export const cleanupResolvedCopyrightClaims = onSchedule('every 24 hours', async () => {
  const { copyrightClaimYears } = await getDataRetentionSettings()
  const cutoff = cutoffDaysAgo(copyrightClaimYears * 365)

  await processInBatches(
    db
      .collection('copyrightClaims')
      .where('status', 'in', ['resolved', 'rejected', 'restored'])
      .where('reviewedAt', '<=', cutoff),
    async (doc) => {
      const claim = doc.data()
      if (claim.claimantName === '[redacted]') return // already anonymised
      await doc.ref.update({
        claimantName: '[redacted]',
        claimantEmail: '[redacted]',
        claimantCompany: null,
        description: '[redacted]',
        supportingLinks: [],
        evidenceUrls: [],
        declarationSignature: '[redacted]',
      })
    },
  )
})

export const cleanupOldAuditLogs = onSchedule('every 24 hours', async () => {
  const { auditLogMonths } = await getDataRetentionSettings()
  const cutoff = cutoffDaysAgo(auditLogMonths * 30)
  await deleteQueryBatched(db.collection('auditLogs').where('createdAt', '<=', cutoff))
})

/** rateLimits/* windows are ephemeral counters (see functions/src/rateLimit.ts) — a fixed 7-day sweep keeps the collection bounded. */
export const cleanupOldRateLimits = onSchedule('every 24 hours', async () => {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  await deleteQueryBatched(db.collection('rateLimits').where('windowStart', '<=', cutoff))
})

const ORPHAN_UPLOAD_AGE_HOURS = 24

/**
 * uploadTrackAssets uploads the master/streaming/preview/artwork files
 * before createTrack ever writes the Firestore doc (the trackId is
 * generated client-side up front so all four share it as a filename) — a
 * closed tab, failed network request, or abandoned upload partway through
 * leaves those Storage objects with nothing that will ever reference or
 * delete them. This sweeps artists/*​/originals/ for files old enough that
 * they're clearly not a still-in-progress upload, checks whether a track
 * doc actually exists for that ID, and if not, deletes that file and its
 * same-trackId siblings across the other three folders.
 */
export const cleanupOrphanedUploads = onSchedule('every 24 hours', async () => {
  const bucket = getStorage().bucket()
  const cutoffMs = Date.now() - ORPHAN_UPLOAD_AGE_HOURS * 60 * 60 * 1000

  const [files] = await bucket.getFiles({ prefix: 'artists/', maxResults: 2000 })
  const originals = files.filter((f) => f.name.includes('/originals/'))

  for (const file of originals) {
    const created = file.metadata.timeCreated ? new Date(file.metadata.timeCreated).getTime() : 0
    if (created > cutoffMs) continue // still within the normal upload window

    const match = file.name.match(/^artists\/([^/]+)\/originals\/([^./]+)\./)
    if (!match) continue
    const [, artistId, trackId] = match

    const trackSnap = await db.collection('tracks').doc(trackId).get()
    if (trackSnap.exists) continue // legitimate track — not an orphan

    await Promise.all([
      file.delete({ ignoreNotFound: true }),
      bucket.deleteFiles({ prefix: `artists/${artistId}/streaming/${trackId}.` }).catch(() => undefined),
      bucket.deleteFiles({ prefix: `artists/${artistId}/previews/${trackId}.` }).catch(() => undefined),
      bucket.deleteFiles({ prefix: `artists/${artistId}/artwork/${trackId}.` }).catch(() => undefined),
    ])
  }
})
