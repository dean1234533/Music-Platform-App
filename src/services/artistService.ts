import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'

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

const requestCreateArtistProfile = callable<CreateArtistProfileInput, { slug: string }>('createArtistProfile')

/**
 * Requests the "create my artist profile" action — the only legitimate way
 * an already-onboarded account gains the artist role (firestore.rules
 * freezes a regular account's own roles field after its initial signup
 * choice). Always acts on the calling account; there is no way to pass a
 * different uid, by design — the server decides who this is from the
 * authenticated request, never from client input. The slug reservation and
 * role grant both happen server-side, atomically, in the createArtistProfile
 * Cloud Function.
 */
export async function createArtistProfile(input: CreateArtistProfileInput): Promise<string> {
  const { slug } = await requestCreateArtistProfile(input)
  return slug
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
