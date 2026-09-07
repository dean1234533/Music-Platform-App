import { db } from './admin.js'

export async function userHasRole(uid: string, role: 'fan' | 'artist' | 'dj' | 'admin'): Promise<boolean> {
  const snap = await db.collection('users').doc(uid).get()
  const roles = (snap.data()?.roles ?? []) as string[]
  return roles.includes(role)
}
