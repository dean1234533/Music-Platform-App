import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'

export async function listNewReleaseTracks(count = 20): Promise<TrackDoc[]> {
  const q = query(
    collection(db, 'tracks'),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(count),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as TrackDoc)
}

export async function listMostSupportedArtists(count = 12): Promise<ArtistProfile[]> {
  const q = query(collection(db, 'artistProfiles'), orderBy('supporterCount', 'desc'), limit(count))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as ArtistProfile)
}

export async function listRisingArtists(count = 12): Promise<ArtistProfile[]> {
  const q = query(collection(db, 'artistProfiles'), orderBy('followerCount', 'desc'), limit(count))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as ArtistProfile)
}

export async function listArtistsSeekingDJExposure(count = 12): Promise<TrackDoc[]> {
  // See listDJPromotionTracks in trackService.ts for why visibility is constrained here.
  const q = query(
    collection(db, 'tracks'),
    where('djPromotion', '==', true),
    where('visibility', 'in', ['public', 'dj_only']),
    orderBy('createdAt', 'desc'),
    limit(count),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as TrackDoc)
}

export async function listByGenre(genre: string, count = 20): Promise<TrackDoc[]> {
  const q = query(
    collection(db, 'tracks'),
    where('visibility', '==', 'public'),
    where('genre', '==', genre),
    orderBy('createdAt', 'desc'),
    limit(count),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as TrackDoc)
}
