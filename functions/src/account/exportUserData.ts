import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getStorage } from 'firebase-admin/storage'
import { db } from '../admin.js'

const EXPORT_URL_TTL_MS = 24 * 60 * 60 * 1000

async function docsWhere(collection: string, field: string, uid: string) {
  const snap = await db.collection(collection).where(field, '==', uid).get()
  return snap.docs.map((d) => d.data())
}

/**
 * Produces a one-off JSON export of the caller's own account data, uploaded
 * to a private Storage path only this function can generate a signed URL
 * for (storage.rules blocks direct client reads/writes of exports/ entirely).
 * Deliberately excludes Stripe secrets, other users' private data, and
 * internal moderation notes — only the requesting user's own records.
 */
export const exportUserData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid

  const [userDoc, artistProfile, djProfile] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('artistProfiles').doc(uid).get(),
    db.collection('djProfiles').doc(uid).get(),
  ])

  const [
    tracks,
    playlists,
    crates,
    djDeals,
    requestsAsDj,
    requestsAsArtist,
    agreementsAsDj,
    agreementsAsArtist,
    downloadLogs,
    notifications,
    legalAcceptances,
  ] = await Promise.all([
    docsWhere('tracks', 'artistId', uid),
    docsWhere('playlists', 'ownerId', uid),
    docsWhere('crates', 'ownerId', uid),
    docsWhere('djDeals', 'artistId', uid),
    docsWhere('licenceRequests', 'djId', uid),
    docsWhere('licenceRequests', 'artistId', uid),
    docsWhere('licenceAgreements', 'djId', uid),
    docsWhere('licenceAgreements', 'artistId', uid),
    docsWhere('downloadLogs', 'djId', uid),
    docsWhere('notifications', 'userId', uid),
    docsWhere('legalAcceptances', 'userId', uid),
  ])

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    account: userDoc.exists ? userDoc.data() : null,
    artistProfile: artistProfile.exists ? artistProfile.data() : null,
    djProfile: djProfile.exists ? djProfile.data() : null,
    tracks,
    playlists,
    crates,
    djDeals,
    licenceRequests: [...requestsAsDj, ...requestsAsArtist],
    licenceAgreements: [...agreementsAsDj, ...agreementsAsArtist],
    downloadLogs,
    notifications,
    legalAcceptances,
  }

  const path = `exports/${uid}/${Date.now()}.json`
  const file = getStorage().bucket().file(path)
  await file.save(JSON.stringify(exportPayload, null, 2), { contentType: 'application/json' })

  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + EXPORT_URL_TTL_MS })
  return { url, expiresInSeconds: EXPORT_URL_TTL_MS / 1000 }
})
