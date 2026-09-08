import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function likeId(fanId: string, trackId: string): string {
  return `${fanId}_${trackId}`
}

function likeRef(fanId: string, trackId: string) {
  return doc(db, 'trackLikes', likeId(fanId, trackId))
}

export async function likeTrack(fanId: string, trackId: string): Promise<void> {
  await setDoc(likeRef(fanId, trackId), { fanId, trackId, createdAt: serverTimestamp() })
}

export async function unlikeTrack(fanId: string, trackId: string): Promise<void> {
  await deleteDoc(likeRef(fanId, trackId))
}

export function subscribeIsLiked(
  fanId: string,
  trackId: string,
  onChange: (liked: boolean) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    likeRef(fanId, trackId),
    (snap) => onChange(snap.exists()),
    (error) => {
      console.error('[subscribeIsLiked] listener error:', error)
      onError?.(error)
    },
  )
}

export async function listLikedTrackIds(fanId: string): Promise<string[]> {
  const q = query(collection(db, 'trackLikes'), where('fanId', '==', fanId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data().trackId as string)
}

export function subscribeLikedTrackIds(
  fanId: string,
  onChange: (trackIds: string[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'trackLikes'), where('fanId', '==', fanId))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((document) => document.data().trackId as string)),
    (error) => {
      console.error('[subscribeLikedTrackIds] listener error:', error)
      onError?.(error)
    },
  )
}
