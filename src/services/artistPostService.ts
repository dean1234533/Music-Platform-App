import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ArtistPost } from '@/types/artist'

export function newPostId(): string {
  return doc(collection(db, 'artistPosts')).id
}

export async function createArtistPost(
  artistId: string,
  input: { title: string; body: string; visibility: ArtistPost['visibility'] },
): Promise<void> {
  const postId = newPostId()
  await setDoc(doc(db, 'artistPosts', postId), {
    postId,
    artistId,
    visibility: input.visibility,
    type: 'text',
    title: input.title,
    body: input.body,
    mediaURL: null,
    createdAt: serverTimestamp(),
  })
}

export async function deleteArtistPost(postId: string): Promise<void> {
  await deleteDoc(doc(db, 'artistPosts', postId))
}

export function subscribeArtistPosts(artistId: string, onChange: (posts: ArtistPost[]) => void) {
  const q = query(collection(db, 'artistPosts'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data() as ArtistPost)))
}

/**
 * For a public visitor, a single unfiltered query would fail Firestore's
 * rules (a list query fails entirely if it *could* match an unreadable
 * doc). So we query each visibility tier the viewer is actually entitled to
 * separately — each of those queries is provably safe under the rules —
 * and merge the results client-side.
 */
export function subscribePublicArtistPosts(
  artistId: string,
  viewer: { isFollowing: boolean; isSupporting: boolean },
  onChange: (posts: ArtistPost[]) => void,
): () => void {
  const tiers: Array<ArtistPost['visibility']> = ['everyone']
  if (viewer.isFollowing) tiers.push('followers')
  if (viewer.isSupporting) tiers.push('supporters')

  const results = new Map<ArtistPost['visibility'], ArtistPost[]>()
  const emit = () => {
    const merged = tiers.flatMap((tier) => results.get(tier) ?? [])
    merged.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    onChange(merged)
  }

  const unsubscribers = tiers.map((tier) => {
    const q = query(
      collection(db, 'artistPosts'),
      where('artistId', '==', artistId),
      where('visibility', '==', tier),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snap) => {
      results.set(tier, snap.docs.map((d) => d.data() as ArtistPost))
      emit()
    })
  })

  return () => unsubscribers.forEach((unsub) => unsub())
}
