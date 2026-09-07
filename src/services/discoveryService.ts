import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'
import { listDJPromotionTracksFiltered, type DjTrackFilters } from './trackService'

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

/**
 * DJ Discover feed. `filters`/`includeProPlusOnly` are only meaningful for
 * DJ Pro (advancedFiltering) / Pro+ (privatePromoPools) — pass neither for
 * DJ Free's plain feed. See listDJPromotionTracksFiltered in trackService.ts.
 */
export async function listArtistsSeekingDJExposure(
  count = 12,
  filters: DjTrackFilters = {},
  includeProPlusOnly = false,
): Promise<TrackDoc[]> {
  return listDJPromotionTracksFiltered(filters, { includeProPlusOnly, count })
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
