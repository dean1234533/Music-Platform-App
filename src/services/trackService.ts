import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { db, functions, storage } from '@/lib/firebase'
import type { LicenceMode, TrackCredits, TrackDoc, TrackVisibility } from '@/types/track'

function trackRef(trackId: string) {
  return doc(db, 'tracks', trackId)
}

export function newTrackId(): string {
  return doc(collection(db, 'tracks')).id
}

export interface UploadedTrackAssets {
  previewAudioPath: string
  originalAudioPath: string
  artworkURL: string | null
}

/**
 * Uploads the three track assets to their dedicated, access-controlled
 * Storage prefixes. Originals live under /originals/ which Storage rules
 * keep private to the owning artist — never read back a public URL for it.
 */
export async function uploadTrackAssets(
  artistId: string,
  trackId: string,
  files: { preview: File; original: File; artwork: File | null },
): Promise<UploadedTrackAssets> {
  const previewPath = `artists/${artistId}/previews/${trackId}.${extOf(files.preview)}`
  const originalPath = `artists/${artistId}/originals/${trackId}.${extOf(files.original)}`

  await uploadBytes(ref(storage, previewPath), files.preview)
  await uploadBytes(ref(storage, originalPath), files.original)

  let artworkURL: string | null = null
  if (files.artwork) {
    const artworkPath = `artists/${artistId}/artwork/${trackId}.${extOf(files.artwork)}`
    const artworkSnap = await uploadBytes(ref(storage, artworkPath), files.artwork)
    artworkURL = await getDownloadURL(artworkSnap.ref)
  }

  return { previewAudioPath: previewPath, originalAudioPath: originalPath, artworkURL }
}

function extOf(file: File): string {
  const parts = file.name.split('.')
  return parts.length > 1 ? parts[parts.length - 1]! : 'bin'
}

export interface CreateTrackInput {
  title: string
  genre: string
  subgenre: string | null
  bpm: number | null
  mood: string | null
  key: string | null
  /** Denormalized from the artist's profile at upload time — pass ArtistProfile.location. */
  location: string | null
  description: string
  explicit: boolean
  albumId: string | null
  credits: TrackCredits
  visibility: TrackVisibility
  previewDurationSec: number
  previewStartSec: number
  djPromotion: boolean
  djLicenceMode: LicenceMode
  djFixedPrice: number | null
  /** Legacy audience marker; new uploads use `all`. */
  djPromoTier: 'all' | 'pro_plus_only'
  /** Optional release embargo. */
  embargoUntil: Date | null
}

export async function createTrack(
  artistId: string,
  trackId: string,
  assets: UploadedTrackAssets,
  input: CreateTrackInput,
): Promise<void> {
  const track: Omit<TrackDoc, 'createdAt' | 'updatedAt' | 'releaseDate'> & {
    createdAt: unknown
    updatedAt: unknown
    releaseDate: unknown
  } = {
    trackId,
    artistId,
    title: input.title,
    titleLower: input.title.toLowerCase(),
    albumId: input.albumId,
    genre: input.genre,
    subgenre: input.subgenre,
    bpm: input.bpm,
    mood: input.mood,
    key: input.key,
    location: input.location,
    releaseDate: serverTimestamp(),
    description: input.description,
    explicit: input.explicit,
    credits: input.credits,
    previewAudioPath: assets.previewAudioPath,
    previewDurationSec: input.previewDurationSec,
    previewStartSec: input.previewStartSec,
    originalAudioPath: assets.originalAudioPath,
    artworkURL: assets.artworkURL,
    visibility: input.visibility,
    djPromotion: input.djPromotion,
    djLicenceMode: input.djLicenceMode,
    djFixedPrice: input.djFixedPrice,
    djPromoTier: input.djPromoTier,
    embargoUntil: input.embargoUntil ? Timestamp.fromDate(input.embargoUntil) : null,
    playCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    rightsConfirmed: true,
  }
  await setDoc(trackRef(trackId), track)
}

export async function getTrack(trackId: string): Promise<TrackDoc | null> {
  const snap = await getDoc(trackRef(trackId))
  return snap.exists() ? (snap.data() as TrackDoc) : null
}

export function subscribeTrack(trackId: string, onChange: (track: TrackDoc | null) => void) {
  return onSnapshot(trackRef(trackId), (snap) => {
    onChange(snap.exists() ? (snap.data() as TrackDoc) : null)
  })
}

export async function getPreviewPlaybackURL(track: TrackDoc): Promise<string> {
  return getDownloadURL(ref(storage, track.previewAudioPath))
}

export async function listNewReleases(count = 20): Promise<TrackDoc[]> {
  const q = query(
    collection(db, 'tracks'),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(count),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as TrackDoc)
}

export interface DjTrackFilters {
  genre?: string
  mood?: string
  key?: string
  licenceMode?: LicenceMode
  location?: string
  bpmMin?: number
  bpmMax?: number
}

/**
 * DJ discovery filtering. Only `genre` is pushed into the Firestore
 * query (the one equality field worth an index at this app's scale) — the
 * rest are applied client-side over a bounded page. Not a scalable search
 * solution; fine for the catalogue sizes this app runs at today.
 *
 * `includeDjOnly` must be false for any non-DJ caller (e.g. the fan-facing
 * Discover page): Firestore validates a list query against rules for every
 * value the `in` filter could match, not just what's actually returned —
 * including 'dj_only' when the requester lacks the dj role makes the whole
 * query fail with permission-denied, even if no dj_only track exists.
 */
export async function listDJPromotionTracksFiltered(
  filters: DjTrackFilters = {},
  opts: { includeProPlusOnly?: boolean; includeDjOnly?: boolean; count?: number } = {},
): Promise<TrackDoc[]> {
  const visibilities = opts.includeDjOnly ? ['public', 'dj_only'] : ['public']
  const constraints = [where('djPromotion', '==', true), where('visibility', 'in', visibilities)]
  if (filters.genre) constraints.push(where('genre', '==', filters.genre))

  const q = query(collection(db, 'tracks'), ...constraints, orderBy('createdAt', 'desc'), limit(opts.count ?? 100))
  const snap = await getDocs(q)
  const now = Date.now()

  return snap.docs
    .map((d) => d.data() as TrackDoc)
    .filter((t) => t.embargoUntil == null || t.embargoUntil.toMillis() <= now)
    .filter((t) => opts.includeProPlusOnly || t.djPromoTier === 'all')
    .filter((t) => !filters.mood || t.mood === filters.mood)
    .filter((t) => !filters.key || t.key === filters.key)
    .filter((t) => !filters.licenceMode || t.djLicenceMode === filters.licenceMode)
    .filter((t) => !filters.location || t.location === filters.location)
    .filter((t) => filters.bpmMin == null || (t.bpm != null && t.bpm >= filters.bpmMin))
    .filter((t) => filters.bpmMax == null || (t.bpm != null && t.bpm <= filters.bpmMax))
}

/** Convenience query for DJ discovery. */
export async function listDJPromotionTracks(count = 20): Promise<TrackDoc[]> {
  return listDJPromotionTracksFiltered({}, { includeProPlusOnly: true, includeDjOnly: true, count })
}

/** Server-side play counting keeps playCount out of reach of client tampering. */
export async function recordPreviewPlay(trackId: string): Promise<void> {
  const fn = httpsCallable(functions, 'recordPreviewPlay')
  await fn({ trackId })
}
