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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates the Firestore user document the first time someone signs in, if the
 * auth-trigger Cloud Function hasn't already created it. Only ever writes
 * safe defaults — roles/subscriptionStatus can't be escalated this way
 * because Firestore rules pin their values on create.
 *
 * Right after signInWithPopup resolves, the Firestore SDK's own auth-token
 * listener can briefly lag behind the auth state onAuthStateChanged just
 * fired — the very first write can lose that race and get evaluated with
 * request.auth still null, i.e. permission-denied. Forcing a fresh ID token
 * closes most of that gap; the one retry covers what's left.
 */
export async function ensureUserDocument(user: User): Promise<void> {
  await user.getIdToken()

  const ref = userRef(user.uid)
  const write = async () => {
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

  try {
    await write()
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code !== 'permission-denied') throw error
    await sleep(500)
    await write()
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

export async function updateBasicProfile(
  uid: string,
  data: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'notificationPreferences'>>,
): Promise<void> {
  await updateDoc(userRef(uid), { ...data, updatedAt: serverTimestamp() })
}
