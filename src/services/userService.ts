import type { User } from 'firebase/auth'
import {
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

/**
 * Creates the Firestore user document the first time someone signs in, if the
 * auth-trigger Cloud Function hasn't already created it. Only ever writes
 * safe defaults — roles/subscriptionStatus can't be escalated this way
 * because Firestore rules pin their values on create.
 */
export async function ensureUserDocument(user: User): Promise<void> {
  const ref = userRef(user.uid)
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

export async function updateBasicProfile(
  uid: string,
  data: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'notificationPreferences'>>,
): Promise<void> {
  await updateDoc(userRef(uid), { ...data, updatedAt: serverTimestamp() })
}
