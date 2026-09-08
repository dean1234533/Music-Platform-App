import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import type { Query } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { db } from '../admin.js'
import { getStripe, stripeSecretKey } from '../stripe/client.js'

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
 * Deletes every track owned by the artist, unless it's referenced by a
 * still-active licence agreement — in which case the file must survive for
 * the DJ's existing entitlement (spec §23/§24), so it's unpublished instead
 * of removed: private + taken down, but left in place for getSecureDownloadUrl
 * (which never checks visibility/takenDown, only the agreement itself).
 */
async function offboardArtistTracks(artistId: string): Promise<void> {
  const tracksSnap = await db.collection('tracks').where('artistId', '==', artistId).get()
  for (const trackDoc of tracksSnap.docs) {
    const track = trackDoc.data()
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

    await Promise.all([
      deleteStorageFile(track.originalAudioPath),
      deleteStorageFile(track.previewAudioPath),
      deleteStorageFile(track.streamAudioPath),
    ])
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
 * Full account deletion: Firebase Auth user, users doc, artist/DJ profiles
 * and their public visibility, uploaded content not covered by an active
 * licence, playlists/crates/follows/likes/notifications/deals. Deliberately
 * leaves licenceRequests, licenceOffers, licenceAgreements, conversations,
 * messages, downloadLogs, transactions, payouts, and copyright/verification
 * records untouched — those are the "minimum contract record" the other
 * party's evidence depends on (spec §24) and are subject to their own
 * retention schedule, not this flow. Idempotent: every step is safe to
 * re-run if a previous attempt partially failed.
 */
export const deleteAccount = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid

  const authTime = request.auth.token.auth_time as number | undefined
  if (!authTime || Date.now() / 1000 - authTime > RECENT_AUTH_WINDOW_SEC) {
    throw new HttpsError('failed-precondition', 'Please sign in again before deleting your account.')
  }

  const statusRef = db.collection('accountDeletions').doc(uid)
  await statusRef.set(
    { uid, status: 'processing', requestedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )

  try {
    const userSnap = await db.collection('users').doc(uid).get()
    const roles = (userSnap.data()?.roles ?? []) as string[]

    const subscriptionRef = db.collection('subscriptions').doc(`${uid}_fan`)
    const subscriptionSnap = await subscriptionRef.get()
    const stripeSubscriptionId = subscriptionSnap.data()?.stripeSubscriptionId as string | undefined
    if (stripeSubscriptionId) {
      try {
        await getStripe().subscriptions.cancel(stripeSubscriptionId)
      } catch (error) {
        if ((error as { code?: string }).code !== 'resource_missing') throw error
      }
    }

    if (roles.includes('artist')) {
      await offboardArtistTracks(uid)
      await offboardArtistStories(uid)
      await deleteQueryBatched(db.collection('djDeals').where('artistId', '==', uid))
      await deleteQueryBatched(db.collection('artistPosts').where('artistId', '==', uid))
      await deleteQueryBatched(db.collection('fanOffers').where('artistId', '==', uid))
      await deleteQueryBatched(db.collection('fanOfferClaims').where('artistId', '==', uid))
      await deleteStorageFolder(`artists/${uid}/artwork/`)
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
    await db.collection('supportAllocations').doc(uid).delete()
    await subscriptionRef.delete()

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
    throw new HttpsError('internal', 'Account deletion failed partway through — it is safe to try again.')
  }

  return { ok: true }
})
