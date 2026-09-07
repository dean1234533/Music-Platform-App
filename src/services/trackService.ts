import {
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

export async function listDJPromotionTracks(count = 20): Promise<TrackDoc[]> {
  // Constrained to visibilities the tracks rule makes globally readable —
  // an unconstrained djPromotion query could match a non-public track the
  // viewer can't read, which fails the whole query under Firestore rules.
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

/** Server-side play counting keeps playCount out of reach of client tampering. */
export async function recordPreviewPlay(trackId: string): Promise<void> {
  const fn = httpsCallable(functions, 'recordPreviewPlay')
  await fn({ trackId })
}
