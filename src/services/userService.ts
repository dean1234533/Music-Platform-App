import type { User } from 'firebase/auth'
import {
  arrayRemove,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UserProfile, UserRole } from '@/types/user'

const ONBOARDING_ROLES: UserRole[] = ['fan', 'artist', 'dj']

function userRef(uid: string) {
  return doc(db, 'users', uid)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates the Firestore user document the first time someone signs in, if the
 * auth-trigger Cloud Function hasn't already created it. Only ever writes
 * safe defaults — roles/subscriptionStatus can't be escalated this way
 * because Firestore rules pin their values on create.
 *
 * Right after sign-in resolves, the Firestore SDK's auth-token listener can
 * briefly lag behind Firebase Auth. A forced token refresh plus bounded retry
 * keeps that startup race from surfacing as a broken first-time profile.
 */
export async function ensureUserDocument(user: User): Promise<void> {
  const ref = userRef(user.uid)
  const retryDelays = [0, 250, 500, 1_000, 2_000]

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await sleep(retryDelays[attempt])
    try {
      await user.getIdToken(true)
      const existing = await getDoc(ref)
      if (existing.exists()) return
      await setDoc(ref, {
        uid: user.uid,
        displayName: user.displayName ?? null,
        email: user.email ?? null,
        photoURL: user.photoURL ?? null,
        roles: [] as UserRole[],
        onboardingComplete: false,
        subscriptionStatus: 'none',
        notificationPreferences: { email: true, inApp: true },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return
    } catch (error) {
      const code = (error as { code?: string } | null)?.code
      const retryable = code === 'permission-denied' || code === 'unavailable'
      if (!retryable || attempt === retryDelays.length - 1) throw error
    }
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userRef(uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export function subscribeToUserProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    userRef(uid),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as UserProfile) : null)
    },
    (error) => {
      console.error('[subscribeToUserProfile] listener error:', error)
      onError?.(error)
    },
  )
}

export async function completeOnboarding(uid: string, roles: UserRole[]): Promise<void> {
  const safeRoles = roles.filter((role): role is UserRole => ONBOARDING_ROLES.includes(role))
  await updateDoc(userRef(uid), {
    roles: safeRoles,
    onboardingComplete: true,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Steps back from a role — never grants 'admin' or removes it (Firestore
 * rules block both regardless), so this is safe to expose as a self-service
 * action even on an admin account. Doesn't touch or delete the underlying
 * artistProfiles/djProfiles doc: removing 'artist'/'dj' just makes that
 * profile stop being publicly readable (see firestore.rules'
 * roleActiveFor) until the role is added back via the add-role flow, at
 * which point the same profile reappears exactly as it was.
 */
export async function removeRole(uid: string, role: Exclude<UserRole, 'admin'>): Promise<void> {
  await updateDoc(userRef(uid), {
    roles: arrayRemove(role),
    updatedAt: serverTimestamp(),
  })
}

export async function updateBasicProfile(
  uid: string,
  data: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'notificationPreferences'>>,
): Promise<void> {
  await updateDoc(userRef(uid), { ...data, updatedAt: serverTimestamp() })
}
