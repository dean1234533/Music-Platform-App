import { HttpsError } from 'firebase-functions/v2/https'
import { db } from './admin.js'

export async function userHasRole(uid: string, role: 'fan' | 'artist' | 'dj' | 'admin'): Promise<boolean> {
  const snap = await db.collection('users').doc(uid).get()
  const roles = (snap.data()?.roles ?? []) as string[]
  return roles.includes(role)
}

/**
 * blockSuspendedSignIn (a beforeUserSignedIn blocking function) can't be
 * deployed without upgrading to Identity Platform, so a suspended user can
 * still hold a valid Firebase Auth token — the frontend's ProtectedRoute
 * keeps them out of the UI, but nothing stopped them calling a callable
 * directly with that token. This is the equivalent server-side check for
 * every state-changing callable that doesn't already gate on a specific
 * resource the suspension would otherwise be irrelevant to.
 */
export async function requireActiveUser(uid: string): Promise<void> {
  const snap = await db.collection('users').doc(uid).get()
  if (snap.data()?.suspended === true) {
    throw new HttpsError('permission-denied', 'This account has been suspended.')
  }
}
