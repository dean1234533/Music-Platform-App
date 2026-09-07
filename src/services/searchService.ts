import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'

/**
 * Firestore-native prefix search over denormalised lowercase fields. This is
 * intentionally simple for Phase 1 — if richer full-text search is needed
 * later (typo tolerance, ranking, fuzzy match), swap in a dedicated search
 * provider behind this same function signature rather than rewriting callers.
 */
export interface SearchResults {
  artists: ArtistProfile[]
  tracks: TrackDoc[]
}

const PREFIX_UPPER_BOUND_SUFFIX = ''

export async function searchPlatform(rawTerm: string): Promise<SearchResults> {
  const term = rawTerm.trim().toLowerCase()
  if (!term) return { artists: [], tracks: [] }

  const upperBound = term + PREFIX_UPPER_BOUND_SUFFIX

  const [artistSnap, trackSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'artistProfiles'),
        orderBy('nameLower'),
        where('nameLower', '>=', term),
        where('nameLower', '<=', upperBound),
        limit(15),
      ),
    ),
    getDocs(
      query(
        collection(db, 'tracks'),
        where('visibility', '==', 'public'),
        orderBy('titleLower'),
        where('titleLower', '>=', term),
        where('titleLower', '<=', upperBound),
        limit(15),
      ),
    ),
  ])

  return {
    artists: artistSnap.docs.map((d) => d.data() as ArtistProfile),
    tracks: trackSnap.docs.map((d) => d.data() as TrackDoc),
  }
}
