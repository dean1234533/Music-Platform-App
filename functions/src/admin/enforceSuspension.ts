import { beforeUserSignedIn, HttpsError } from 'firebase-functions/v2/identity'
import { db } from '../admin.js'

/**
 * Actual enforcement for adminSetUserSuspension — a `suspended: true` flag
 * on its own does nothing; this blocking function is what turns it into a
 * real restriction rather than a UI-only badge.
 */
export const blockSuspendedSignIn = beforeUserSignedIn(async (event) => {
  const uid = event.data?.uid
  if (!uid) return
  const snap = await db.collection('users').doc(uid).get()
  if (snap.data()?.suspended === true) {
    throw new HttpsError('permission-denied', 'This account has been suspended.')
  }
})
