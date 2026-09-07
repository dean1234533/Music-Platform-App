import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DJProfile } from '@/types/dj'

function djRef(djId: string) {
  return doc(db, 'djProfiles', djId)
}

export interface CreateDJProfileInput {
  name: string
  bio: string
  genres: string[]
  country: string
  city: string
}

export async function createDJProfile(djId: string, input: CreateDJProfileInput): Promise<void> {
  // Idempotent: a retried/queued call (e.g. a write that was offline when
  // first submitted, replaying later) must not attempt to overwrite an
  // already-created profile — Firestore rules would reject the mismatched
  // frozen fields (verificationStatus/requestsThisMonth/planTier may have
  // moved on since creation).
  const existing = await getDoc(djRef(djId))
  if (existing.exists()) return

  await setDoc(djRef(djId), {
    djId,
    name: input.name,
    realName: null,
    photoURL: null,
    coverURL: null,
    bio: input.bio,
    genres: input.genres,
    country: input.country,
    city: input.city,
    venues: [],
    website: null,
    socialLinks: {},
    verificationStatus: 'unverified',
    requestsThisMonth: 0,
    requestsMonthResetAt: null,
    planTier: 'free',
    bulkOutreachOptIn: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function getDJProfile(djId: string): Promise<DJProfile | null> {
  const snap = await getDoc(djRef(djId))
  return snap.exists() ? (snap.data() as DJProfile) : null
}

export function subscribeDJProfile(djId: string, onChange: (profile: DJProfile | null) => void) {
  return onSnapshot(djRef(djId), (snap) => {
    onChange(snap.exists() ? (snap.data() as DJProfile) : null)
  })
}

export async function updateDJProfile(
  djId: string,
  data: Partial<Omit<DJProfile, 'djId' | 'createdAt' | 'verificationStatus'>>,
): Promise<void> {
  await updateDoc(djRef(djId), { ...data, updatedAt: serverTimestamp() })
}
