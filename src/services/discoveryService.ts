import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'
import { listDJPromotionTracksFiltered, type DjTrackFilters } from './trackService'

export async function listNewReleaseTracks(count = 20): Promise<TrackDoc[]> {
  const q = query(
    collection(db, 'tracks'),
    where('visibility', 'in', ['public', 'followers', 'supporters', 'early_access']),
    orderBy('createdAt', 'desc'),
    limit(count),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as TrackDoc).filter(isFanDiscoverable)
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
 * Tracks open for DJ promotion. Used both by the fan-facing Discover page
 * (public only — leave includeDjOnly false) and the DJ Discover page (DJs
 * may also see dj_only tracks — pass includeDjOnly true there).
 * Filters are available to every DJ. `includeProPlusOnly` retains visibility
 * for legacy tracks that used the retired creator-plan audience marker.
 * See listDJPromotionTracksFiltered in trackService.ts.
 */
export async function listArtistsSeekingDJExposure(
  count = 12,
  filters: DjTrackFilters = {},
  includeProPlusOnly = false,
  includeDjOnly = false,
): Promise<TrackDoc[]> {
  return listDJPromotionTracksFiltered(filters, { includeProPlusOnly, includeDjOnly, count })
}

export async function listByGenre(genre: string, count = 20): Promise<TrackDoc[]> {
  const q = query(
    collection(db, 'tracks'),
    where('visibility', 'in', ['public', 'followers', 'supporters', 'early_access']),
    where('genre', '==', genre),
    orderBy('createdAt', 'desc'),
    limit(count),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as TrackDoc).filter(isFanDiscoverable)
}

function isFanDiscoverable(track: TrackDoc): boolean {
  return track.takenDown !== true
    && (track.status === undefined || track.status === 'published')
    && !track.restrictedCapabilities?.includes('discovery')
}
