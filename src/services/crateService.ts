import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CrateDoc } from '@/types/crate'

function crateRef(crateId: string) {
  return doc(db, 'crates', crateId)
}

export function newCrateId(): string {
  return doc(collection(db, 'crates')).id
}

export async function createCrate(ownerId: string, title: string): Promise<string> {
  const crateId = newCrateId()
  await setDoc(crateRef(crateId), {
    crateId,
    ownerId,
    title,
    trackIds: [],
    notes: null,
    tags: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return crateId
}

export function subscribeOwnCrates(ownerId: string, onChange: (crates: CrateDoc[]) => void) {
  const q = query(collection(db, 'crates'), where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data() as CrateDoc)))
}

export async function getCrate(crateId: string): Promise<CrateDoc | null> {
  const snap = await getDoc(crateRef(crateId))
  return snap.exists() ? (snap.data() as CrateDoc) : null
}

export async function addTrackToCrate(crateId: string, trackId: string): Promise<void> {
  await updateDoc(crateRef(crateId), { trackIds: arrayUnion(trackId), updatedAt: serverTimestamp() })
}

export async function removeTrackFromCrate(crateId: string, trackId: string): Promise<void> {
  await updateDoc(crateRef(crateId), { trackIds: arrayRemove(trackId), updatedAt: serverTimestamp() })
}

/** Notes and tags are included for every DJ crate. */
export async function updateCrateDetails(crateId: string, data: { notes?: string | null; tags?: string[] }): Promise<void> {
  await updateDoc(crateRef(crateId), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteCrate(crateId: string): Promise<void> {
  await deleteDoc(crateRef(crateId))
}
