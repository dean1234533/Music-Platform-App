import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import type { Query } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { db } from '../admin.js'
import { getStripe, stripeSecretKey } from '../stripe/client.js'
import { requireAdmin, writeAuditLog } from '../admin/guard.js'

const RECENT_AUTH_WINDOW_SEC = 5 * 60

async function deleteQueryBatched(query: Query, batchSize = 300): Promise<void> {
  for (;;) {
    const snap = await query.limit(batchSize).get()
    if (snap.empty) return
    const batch = db.batch()
    for (const doc of snap.docs) batch.delete(doc.ref)
    await batch.commit()
    if (snap.size < batchSize) return
  }
}

async function deleteStorageFolder(prefix: string): Promise<void> {
  try {
    await getStorage().bucket().deleteFiles({ prefix })
  } catch {
    // Best-effort — a missing folder is not an error.
  }
}

async function deleteStorageFile(path: string | null | undefined): Promise<void> {
  if (!path) return
  try {
    await getStorage().bucket().file(path).delete()
  } catch {
    // Already gone or never existed — fine.
  }
}

/**
 * Cancels a Stripe subscription if it isn't already canceled. Stripe keeps a
 * canceled subscription's object around (status: 'canceled') rather than
 * deleting it, and calling subscriptions.cancel() on one that's already
 * canceled raises an invalid_request_error, not resource_missing — the only
 * code the old version of this function tolerated. Without this check, a
 * retried deletion (the previous attempt got this far before failing later)
 * would throw here every time and could never actually complete.
 */
async function cancelStripeSubscriptionIfActive(stripeSubscriptionId: string): Promise<void> {
  const stripe = getStripe()
  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    if (subscription.status === 'canceled') return
    await stripe.subscriptions.cancel(stripeSubscriptionId)
  } catch (error) {
    if ((error as { code?: string }).code !== 'resource_missing') throw error
  }
}

/**
 * Deletes every track owned by the artist, unless it's referenced by a
 * still-active licence agreement — in which case the file must survive for
 * the DJ's existing entitlement (spec §23/§24), so it's unpublished instead
 * of removed: private + taken down, but left in place for getSecureDownloadUrl
 * (which never checks visibility/takenDown, only the agreement itself).
 *
 * Deletes each removed track's own artwork file individually (by uuid-scoped
 * prefix, `artists/{artistId}/artwork/{trackId}.*`) rather than as part of a
 * blanket `artists/{artistId}/artwork/` folder wipe — a preserved track (kept
 * for an active licence) shares that same folder with every other track's
 * artwork, so a folder-level wipe would delete a preserved track's artwork
 * right alongside the ones actually being removed.
 */
async function offboardArtistTracks(artistId: string): Promise<void> {
  const tracksSnap = await db.collection('tracks').where('artistId', '==', artistId).get()
  for (const trackDoc of tracksSnap.docs) {
    const activeAgreement = await db
      .collection('licenceAgreements')
      .where('trackId', '==', trackDoc.id)
      .where('status', '==', 'active')
      .limit(1)
      .get()

    if (!activeAgreement.empty) {
      await trackDoc.ref.update({
        visibility: 'private',
        takenDown: true,
        djPromotion: false,
        djLicenceMode: 'not_available',
        updatedAt: FieldValue.serverTimestamp(),
      })
      continue
    }

    await deleteStorageFolder(`artists/${artistId}/artwork/${trackDoc.id}`)
    await db.collection('trackMedia').doc(trackDoc.id).delete()
    await trackDoc.ref.delete()
  }
}

async function offboardArtistStories(artistId: string): Promise<void> {
  const storiesSnap = await db.collection('stories').where('artistId', '==', artistId).get()
  for (const storyDoc of storiesSnap.docs) {
    const path = storyDoc.data().mediaStoragePath as string | null | undefined
    await deleteStorageFile(path)
    await storyDoc.ref.delete()
  }
}

/**
 * Every artistSlugs doc pointing at this artist — the current slug and any
 * stale ones left behind by a rename (admin/artistSlug.ts keeps those as
 * redirects). Without this, the vanity URL stays permanently reserved
 * against a dead artistId and can never be claimed by anyone else, and
 * getArtistIdForSlug keeps resolving it to an artist that no longer exists.
 */
async function offboardArtistSlugs(artistId: string): Promise<void> {
  await deleteQueryBatched(db.collection('artistSlugs').where('artistId', '==', artistId))
}

/**
 * The actual deletion work, shared by the self-service callable below and
 * adminDeleteAccount — both must run identical cleanup so an admin-triggered
 * deletion isn't a second, potentially-diverging implementation of something
 * this sensitive. Firebase Auth user, users doc, artist/DJ profiles and
 * their public visibility, uploaded content not covered by an active
 * licence, playlists/crates/follows/likes/notifications/deals/blocks/
 * verification requests/support messages/preview-conversion signals/slug
 * reservations. Deliberately leaves licenceRequests, licenceOffers,
 * licenceAgreements, licenceAgreementAcceptances, legalAcceptances,
 * downloadLogs, transactions, payouts, artistBalances, artistPayoutAccounts,
 * payoutHolds, copyrightClaims, reports, and auditLogs untouched — those are
 * financial/legal/moderation records (the "minimum contract record" the
 * other party's evidence depends on, spec §24, plus accounting and abuse
 * history) and are subject to their own retention schedule, not this flow.
 * The `conversations`/`messages` collections are dead — nothing in the
 * current app writes to them — so they're not touched either way.
 * The underlying Stripe Customer object (past invoices/payment methods) is
 * likewise left intact for the same accounting reason; only the account's
 * own active subscriptions are canceled so Stripe stops billing it.
 * Idempotent: every step is safe to re-run if a previous attempt partially
 * failed.
 */
async function performAccountDeletion(uid: string): Promise<void> {
  const statusRef = db.collection('accountDeletions').doc(uid)
  await statusRef.set(
    { uid, status: 'processing', requestedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )

  try {
    const userSnap = await db.collection('users').doc(uid).get()
    const roles = (userSnap.data()?.roles ?? []) as string[]

    // Cancel both the fan support membership AND the Artist Membership —
    // an artist account has an entirely separate recurring subscription
    // (subscriptions/{uid}_artist) from any fan membership it might also
    // hold, and leaving it running would keep billing Stripe with no
    // account left to show for it.
    const fanSubscriptionRef = db.collection('subscriptions').doc(`${uid}_fan`)
    const artistSubscriptionRef = db.collection('subscriptions').doc(`${uid}_artist`)
    for (const subRef of [fanSubscriptionRef, artistSubscriptionRef]) {
      const subSnap = await subRef.get()
      const stripeSubscriptionId = subSnap.data()?.stripeSubscriptionId as string | undefined
      if (stripeSubscriptionId) await cancelStripeSubscriptionIfActive(stripeSubscriptionId)
    }
    // DJ has no billing product (see PricingPage) — confirmed no subscriptions/{uid}_dj
    // doc type exists anywhere in this codebase, so fan+artist is the complete set.

    if (roles.includes('artist')) {
      await offboardArtistTracks(uid)
      await offboardArtistStories(uid)
      await offboardArtistSlugs(uid)
      await deleteQueryBatched(db.collection('djDeals').where('artistId', '==', uid))
      await deleteQueryBatched(db.collection('artistPosts').where('artistId', '==', uid))
      await deleteQueryBatched(db.collection('fanOffers').where('artistId', '==', uid))
      await deleteQueryBatched(db.collection('fanOfferClaims').where('artistId', '==', uid))
      // The artist's own photo/cover, deleted explicitly rather than as a blanket
      // artists/{uid}/artwork/ folder wipe — offboardArtistTracks already deleted each
      // removed track's own artwork individually, and a folder-level wipe here would also
      // delete a preserved track's artwork (kept for an active licence agreement), which
      // shares that same folder.
      await deleteStorageFile(`artists/${uid}/artwork/profile-photo.webp`)
      await deleteStorageFile(`artists/${uid}/artwork/cover-image.webp`)
      await db.collection('artistProfiles').doc(uid).delete()
    }
    if (roles.includes('dj')) {
      await deleteQueryBatched(db.collection('crates').where('ownerId', '==', uid))
      await db.collection('djProfiles').doc(uid).delete()
    }

    await deleteStorageFolder(`users/${uid}/profile/`)
    await deleteQueryBatched(db.collection('playlists').where('ownerId', '==', uid))
    await deleteQueryBatched(db.collection('follows').where('fanId', '==', uid))
    await deleteQueryBatched(db.collection('follows').where('artistId', '==', uid))
    await deleteQueryBatched(db.collection('trackLikes').where('fanId', '==', uid))
    await deleteQueryBatched(db.collection('fanOfferClaims').where('fanId', '==', uid))
    await deleteQueryBatched(db.collection('supportRelationships').where('fanId', '==', uid))
    await deleteQueryBatched(db.collection('supportRelationships').where('artistId', '==', uid))
    await deleteQueryBatched(db.collection('notifications').where('userId', '==', uid))
    // Both sides of a block — the deleted account may have blocked others, or been blocked.
    await deleteQueryBatched(db.collection('blockedUsers').where('blockerId', '==', uid))
    await deleteQueryBatched(db.collection('blockedUsers').where('blockedId', '==', uid))
    // Ephemeral preview->follow/support conversion signal — the deleted account as the fan
    // who previewed (uid) and, separately, as the artist who was previewed (artistId).
    await deleteQueryBatched(db.collection('previewSessions').where('uid', '==', uid))
    await deleteQueryBatched(db.collection('previewSessions').where('artistId', '==', uid))
    // Plain application data (a verification note, a support contact message) — no
    // independent legal/moderation significance once the profile they refer to is gone.
    await deleteQueryBatched(db.collection('verificationRequests').where('userId', '==', uid))
    await deleteQueryBatched(db.collection('supportMessages').where('userId', '==', uid))
    await db.collection('supportAllocations').doc(uid).delete()
    await fanSubscriptionRef.delete()
    await artistSubscriptionRef.delete()

    await db.collection('users').doc(uid).delete()

    try {
      await getAuth().deleteUser(uid)
    } catch (err) {
      // Already deleted (e.g. a retried run) — not an error.
      if ((err as { code?: string }).code !== 'auth/user-not-found') throw err
    }

    const retainsLegalRecords = !(await db.collection('licenceAgreements').where('artistId', '==', uid).limit(1).get())
      .empty || !(await db.collection('licenceAgreements').where('djId', '==', uid).limit(1).get()).empty

    await statusRef.set(
      {
        status: retainsLegalRecords ? 'retained_limited_data' : 'completed',
        completedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  } catch (err) {
    await statusRef.set(
      { status: 'failed', error: err instanceof Error ? err.message : String(err) },
      { merge: true },
    )
    throw err
  }
}

export const deleteAccount = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid

  const authTime = request.auth.token.auth_time as number | undefined
  if (!authTime || Date.now() / 1000 - authTime > RECENT_AUTH_WINDOW_SEC) {
    throw new HttpsError('failed-precondition', 'Please sign in again before deleting your account.')
  }

  try {
    await performAccountDeletion(uid)
  } catch {
    throw new HttpsError('internal', 'Account deletion failed partway through — it is safe to try again.')
  }

  return { ok: true }
})

/**
 * Admin-triggered equivalent of the self-service flow above, for removing
 * another user's account entirely (e.g. on their own request, spam, abuse).
 * Reuses the exact same performAccountDeletion() logic — never a second,
 * divergent implementation of something this destructive. Audit-logged like
 * every other admin action in this codebase.
 */
export const adminDeleteAccount = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const adminId = await requireAdmin(request)
  const { userId } = request.data ?? {}
  if (!userId || typeof userId !== 'string') {
    throw new HttpsError('invalid-argument', 'userId is required.')
  }
  if (userId === adminId) {
    throw new HttpsError('failed-precondition', 'Use account settings to delete your own account, not the admin tool — this prevents an admin from accidentally locking themselves out.')
  }

  try {
    await performAccountDeletion(userId)
  } catch {
    throw new HttpsError('internal', 'Account deletion failed partway through — it is safe to try again.')
  }

  await writeAuditLog(adminId, 'admin_delete_account', { targetUid: userId })

  return { ok: true }
})
