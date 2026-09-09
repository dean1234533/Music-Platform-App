import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'
import { RESERVED_ARTIST_SLUGS, slugify } from '@/utils/slug'

function artistRef(artistId: string) {
  return doc(db, 'artistProfiles', artistId)
}

function slugRef(slug: string) {
  return doc(db, 'artistSlugs', slug)
}

export interface CreateArtistProfileInput {
  name: string
  bio: string
  genres: string[]
  location: string
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`The artist URL "${slug}" is already taken.`)
    this.name = 'SlugTakenError'
  }
}

/**
 * Reserves a unique /artist/{slug} URL and creates the artist profile in one
 * transaction so two artists can never race for the same slug.
 */
export async function createArtistProfile(
  artistId: string,
  input: CreateArtistProfileInput,
): Promise<string> {
  const baseSlug = slugify(input.name) || `artist-${artistId.slice(0, 6)}`

  return runTransaction(db, async (tx) => {
    // Idempotent: a retried/queued call (e.g. a write that was offline when
    // first submitted, replaying later) must not attempt to overwrite an
    // already-created profile — Firestore rules would reject that as an
    // update with a mismatched frozen slug. Return the existing slug instead.
    const existingProfile = await tx.get(artistRef(artistId))
    if (existingProfile.exists()) {
      return existingProfile.data().slug as string
    }

    let candidate = baseSlug
    let attempt = 0
    // Try the natural slug first, then append short suffixes on collision.
    // A reserved word (e.g. "support", "admin") is treated the same as a
    // taken slug rather than a hard block, so a legitimate artist with that
    // name still gets a working URL, just not the bare unqualified one.
    while (attempt < 25) {
      if (!RESERVED_ARTIST_SLUGS.has(candidate)) {
        const existing = await tx.get(slugRef(candidate))
        if (!existing.exists()) break
      }
      attempt += 1
      candidate = `${baseSlug}-${attempt + 1}`
    }
    if (attempt >= 25) {
      throw new SlugTakenError(baseSlug)
    }

    tx.set(slugRef(candidate), { artistId })
    tx.set(artistRef(artistId), {
      artistId,
      slug: candidate,
      name: input.name,
      nameLower: input.name.toLowerCase(),
      bio: input.bio,
      genres: input.genres,
      location: input.location,
      socialLinks: {},
      photoURL: null,
      coverURL: null,
      verified: false,
      followerCount: 0,
      supporterCount: 0,
      djAllowRequests: 'verified_only',
      trackCount: 0,
      perks: [],
      storiesDjEnabled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return candidate
  })
}

/**
 * Follows a slug-change redirect (adminChangeArtistSlug repoints every slug
 * an artist has ever used at the current canonical one, so this is always
 * at most one extra hop, never a chain to walk).
 */
export async function getArtistIdForSlug(slug: string): Promise<string | null> {
  const snap = await getDoc(slugRef(slug))
  if (!snap.exists()) return null
  const data = snap.data()
  if (typeof data.redirectTo === 'string') {
    const target = await getDoc(slugRef(data.redirectTo))
    return target.exists() ? ((target.data().artistId as string) ?? null) : null
  }
  return (data.artistId as string) ?? null
}

export async function getArtistProfile(artistId: string): Promise<ArtistProfile | null> {
  const snap = await getDoc(artistRef(artistId))
  return snap.exists() ? (snap.data() as ArtistProfile) : null
}

export function subscribeArtistProfile(
  artistId: string,
  onChange: (profile: ArtistProfile | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    artistRef(artistId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as ArtistProfile) : null)
    },
    (error) => {
      console.error('[subscribeArtistProfile] listener error:', error)
      onError?.(error)
    },
  )
}

export async function updateArtistProfile(
  artistId: string,
  data: Partial<Omit<ArtistProfile, 'artistId' | 'slug' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(artistRef(artistId), { ...data, updatedAt: serverTimestamp() })
}

/** Owner-only: includes every visibility tier. Only safe when the caller IS artistId (dashboard use). */
export function subscribeArtistTracks(
  artistId: string,
  onChange: (tracks: TrackDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(db, 'tracks'),
    where('artistId', '==', artistId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => d.data() as TrackDoc))
    },
    (error) => {
      console.error('[subscribeArtistTracks] listener error:', error)
      onError?.(error)
    },
  )
}

/**
 * Safe for any visitor, signed in or not: constrained to visibility=='public'
 * so the query can never match a doc the viewer isn't allowed to read (an
 * unconstrained query that *could* match a private track fails outright
 * under Firestore rules, it doesn't just omit that doc).
 */
/**
 * Every track a visitor is meant to see listed on the public profile —
 * including followers/supporters/early_access tiers, which the profile
 * shows locked with a Follow/Support CTA rather than hiding outright. Safe
 * for any visitor: firestore.rules already makes these tiers' metadata
 * (never audio) readable by anyone; dj_only and private stay excluded here
 * since they're not part of the fan acquisition funnel this page drives.
 */
export function subscribePublicArtistTracks(
  artistId: string,
  onChange: (tracks: TrackDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(db, 'tracks'),
    where('artistId', '==', artistId),
    where('visibility', 'in', ['public', 'followers', 'supporters', 'early_access']),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs
          .map((d) => d.data() as TrackDoc)
          .filter((track) => track.takenDown !== true && (track.status === undefined || track.status === 'published') && !track.restrictedCapabilities?.includes('discovery')),
      )
    },
    (error) => {
      console.error('[subscribePublicArtistTracks] listener error:', error)
      onError?.(error)
    },
  )
}
