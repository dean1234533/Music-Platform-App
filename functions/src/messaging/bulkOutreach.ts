import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { userHasRole } from '../roles.js'
import { hasFeature } from '../entitlements.js'

const MAX_MESSAGE_LENGTH = 1000
const BATCH_SIZE = 500

/**
 * Artist Pro+ bulk DJ outreach. The anti-spam mechanism is the query itself:
 * only djProfiles with bulkOutreachOptIn==true are ever notified — there is
 * no path to message a DJ who hasn't explicitly opted in.
 */
export const sendBulkDjOutreach = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const artistId = request.auth.uid
  if (!(await userHasRole(artistId, 'artist'))) {
    throw new HttpsError('permission-denied', 'An artist profile is required.')
  }
  if (!(await hasFeature(artistId, 'artist', 'bulkDjOutreach'))) {
    throw new HttpsError('permission-denied', 'Bulk DJ outreach requires Artist Pro+.')
  }

  const { trackId, message } = request.data ?? {}
  if (!trackId || typeof trackId !== 'string') throw new HttpsError('invalid-argument', 'trackId is required.')
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new HttpsError('invalid-argument', 'message is required.')
  }
  if (message.length > MAX_MESSAGE_LENGTH) throw new HttpsError('invalid-argument', 'Message is too long.')

  const trackSnap = await db.collection('tracks').doc(trackId).get()
  if (!trackSnap.exists || trackSnap.data()?.artistId !== artistId) {
    throw new HttpsError('permission-denied', 'You can only promote your own tracks.')
  }
  const trackTitle = trackSnap.data()?.title ?? 'a track'

  const optedInSnap = await db.collection('djProfiles').where('bulkOutreachOptIn', '==', true).get()
  const docs = optedInSnap.docs

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const doc of docs.slice(i, i + BATCH_SIZE)) {
      batch.set(db.collection('notifications').doc(), {
        userId: doc.id,
        type: 'artist_promo',
        title: `New promo: "${trackTitle}"`,
        body: message.trim().slice(0, 140),
        linkTo: '/dj/discover',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
  }

  return { ok: true, sentCount: docs.length }
})
