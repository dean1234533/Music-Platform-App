import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { GENRES } from '@/constants/musicTaxonomy'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'
import type { DJProfile } from '@/types/dj'

/**
 * Firestore-native prefix search over denormalised lowercase fields for
 * artists/tracks. DJ profiles have no nameLower field to index on, so DJ
 * matching is a bounded fetch + client-side substring filter instead of a
 * schema migration — fine at this catalogue size, swap for a real search
 * provider (typo tolerance, ranking, fuzzy match) if that ever changes for
 * any of these three.
 */
export interface SearchResults {
  artists: ArtistProfile[]
  tracks: TrackDoc[]
  djs: DJProfile[]
}

const PREFIX_UPPER_BOUND_SUFFIX = ''

function matchedGenre(term: string): string | null {
  const lower = term.toLowerCase()
  return GENRES.find((g) => g.toLowerCase() === lower) ?? null
}

export async function searchPlatform(rawTerm: string): Promise<SearchResults> {
  const term = rawTerm.trim().toLowerCase()
  if (!term) return { artists: [], tracks: [], djs: [] }

  const upperBound = term + PREFIX_UPPER_BOUND_SUFFIX
  const genre = matchedGenre(term)

  const [artistSnap, titleTrackSnap, genreTrackSnap, djSnap] = await Promise.all([
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
    genre
      ? getDocs(
          query(
            collection(db, 'tracks'),
            where('visibility', '==', 'public'),
            where('genre', '==', genre),
            orderBy('createdAt', 'desc'),
            limit(15),
          ),
        )
      : Promise.resolve(null),
    getDocs(query(collection(db, 'djProfiles'), limit(200))),
  ])

  const tracksById = new Map<string, TrackDoc>()
  for (const d of titleTrackSnap.docs) tracksById.set(d.id, d.data() as TrackDoc)
  if (genreTrackSnap) for (const d of genreTrackSnap.docs) tracksById.set(d.id, d.data() as TrackDoc)

  const djs = djSnap.docs
    .map((d) => d.data() as DJProfile)
    .filter(
      (dj) =>
        dj.name.toLowerCase().includes(term) ||
        (dj.realName ?? '').toLowerCase().includes(term) ||
        dj.genres.some((g) => g.toLowerCase().includes(term)),
    )
    .slice(0, 15)

  return {
    artists: artistSnap.docs.map((d) => d.data() as ArtistProfile),
    tracks: Array.from(tracksById.values()),
    djs,
  }
}
