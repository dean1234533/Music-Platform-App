import { deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function followId(fanId: string, artistId: string): string {
  return `${fanId}_${artistId}`
}

function followRef(fanId: string, artistId: string) {
  return doc(db, 'follows', followId(fanId, artistId))
}

/**
 * followerCount on the artist profile is updated server-side by a Firestore
 * trigger on this collection, never by the client — see functions/src/follows.ts.
 */
export async function followArtist(fanId: string, artistId: string): Promise<void> {
  await setDoc(followRef(fanId, artistId), {
    fanId,
    artistId,
    createdAt: serverTimestamp(),
  })
}

export async function unfollowArtist(fanId: string, artistId: string): Promise<void> {
  await deleteDoc(followRef(fanId, artistId))
}

export function subscribeIsFollowing(
  fanId: string,
  artistId: string,
  onChange: (following: boolean) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    followRef(fanId, artistId),
    (snap) => onChange(snap.exists()),
    (error) => {
      console.error('[subscribeIsFollowing] listener error:', error)
      onError?.(error)
    },
  )
}

export async function listFollowedArtistIds(fanId: string): Promise<string[]> {
  const q = query(collection(db, 'follows'), where('fanId', '==', fanId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data().artistId as string)
}
