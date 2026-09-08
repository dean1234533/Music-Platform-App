import { HttpsError } from 'firebase-functions/v2/https'
import { db } from './admin.js'

export async function userHasRole(uid: string, role: 'fan' | 'artist' | 'dj' | 'admin'): Promise<boolean> {
  const snap = await db.collection('users').doc(uid).get()
  const roles = (snap.data()?.roles ?? []) as string[]
  return roles.includes(role)
}

/**
 * A `beforeUserSignedIn` blocking function would need an Identity Platform
 * upgrade for no real benefit here — a suspended user briefly holding a
 * valid Auth token doesn't matter as long as nothing they can do with it
 * works. SignInPage already signs them straight back out on the client;
 * this is the server-side backstop for every state-changing callable that
 * doesn't already gate on a specific resource the suspension would
 * otherwise be irrelevant to, in case a token is reused directly.
 */
export async function requireActiveUser(uid: string): Promise<void> {
  const snap = await db.collection('users').doc(uid).get()
  if (snap.data()?.suspended === true) {
    throw new HttpsError('permission-denied', 'This account has been suspended.')
  }
}
