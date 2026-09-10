import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
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

const requestCreateDJProfile = callable<CreateDJProfileInput, { ok: true }>('createDJProfile')

/**
 * Requests the "create my DJ profile" action — the only legitimate way an
 * already-onboarded account gains the DJ role (see createArtistProfile in
 * artistService.ts for the full reasoning). Always acts on the calling
 * account; the profile creation and role grant both happen server-side in
 * the createDJProfile Cloud Function.
 */
export async function createDJProfile(input: CreateDJProfileInput): Promise<void> {
  await requestCreateDJProfile(input)
}

export async function getDJProfile(djId: string): Promise<DJProfile | null> {
  const snap = await getDoc(djRef(djId))
  return snap.exists() ? (snap.data() as DJProfile) : null
}

export function subscribeDJProfile(
  djId: string,
  onChange: (profile: DJProfile | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    djRef(djId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as DJProfile) : null)
    },
    (error) => {
      console.error('[subscribeDJProfile] listener error:', error)
      onError?.(error)
    },
  )
}

export async function updateDJProfile(
  djId: string,
  data: Partial<Omit<DJProfile, 'djId' | 'createdAt' | 'verificationStatus'>>,
): Promise<void> {
  await updateDoc(djRef(djId), { ...data, updatedAt: serverTimestamp() })
}
