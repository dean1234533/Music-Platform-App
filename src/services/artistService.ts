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
import { slugify } from '@/utils/slug'

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
    let candidate = baseSlug
    let attempt = 0
    // Try the natural slug first, then append short suffixes on collision.
    while (attempt < 25) {
      const existing = await tx.get(slugRef(candidate))
      if (!existing.exists()) break
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
      // Safe placeholder — corrected immediately by the onArtistProfileCreate
      // trigger, which mirrors the artist's actual free-tier limit. Starting
      // at 0 fails uploads closed (not open) during that brief window.
      trackLimit: 0,
      planTier: 'free',
      perks: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return candidate
  })
}

export async function getArtistIdForSlug(slug: string): Promise<string | null> {
  const snap = await getDoc(slugRef(slug))
  if (!snap.exists()) return null
  return (snap.data().artistId as string) ?? null
}

export async function getArtistProfile(artistId: string): Promise<ArtistProfile | null> {
  const snap = await getDoc(artistRef(artistId))
  return snap.exists() ? (snap.data() as ArtistProfile) : null
}

export function subscribeArtistProfile(
  artistId: string,
  onChange: (profile: ArtistProfile | null) => void,
): () => void {
  return onSnapshot(artistRef(artistId), (snap) => {
    onChange(snap.exists() ? (snap.data() as ArtistProfile) : null)
  })
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
): () => void {
  const q = query(
    collection(db, 'tracks'),
    where('artistId', '==', artistId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => d.data() as TrackDoc))
  })
}

/**
 * Safe for any visitor, signed in or not: constrained to visibility=='public'
 * so the query can never match a doc the viewer isn't allowed to read (an
 * unconstrained query that *could* match a private track fails outright
 * under Firestore rules, it doesn't just omit that doc).
 */
export function subscribePublicArtistTracks(
  artistId: string,
  onChange: (tracks: TrackDoc[]) => void,
): () => void {
  const q = query(
    collection(db, 'tracks'),
    where('artistId', '==', artistId),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => d.data() as TrackDoc))
  })
}
