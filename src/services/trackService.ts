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
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { db, functions, storage } from '@/lib/firebase'
import type { LicenceMode, TrackCredits, TrackDoc, TrackVisibility } from '@/types/track'
import type { TrackDjDealSettings } from '@/types/deal'
import { slugify } from '@/utils/slug'
import { derivePreviewAsset } from '@/services/audioProcessing'

function trackRef(trackId: string) {
  return doc(db, 'tracks', trackId)
}

/** Track slugs only need to be unique per artist, not globally — the artist's own slug already disambiguates the URL. */
function trackSlugRef(artistId: string, slug: string) {
  return doc(db, 'trackSlugs', `${artistId}_${slug}`)
}

export function newTrackId(): string {
  return doc(collection(db, 'tracks')).id
}

/** Read-side lookup for the nested /artist/:slug/track/:trackSlug route. */
export async function getTrackIdForSlug(artistId: string, slug: string): Promise<string | null> {
  const snap = await getDoc(trackSlugRef(artistId, slug))
  return snap.exists() ? (snap.data().trackId as string) : null
}

export interface UploadedTrackAssets {
  previewAudioPath: string
  streamAudioPath: string
  originalAudioPath: string
  djPreviewAudioPath: string | null
  artworkURL: string | null
}

/**
 * Uploads the master + its derived streaming/preview audio (already trimmed
 * and compressed client-side by audioProcessing.ts before this is called)
 * plus optional artwork, to their dedicated access-controlled Storage
 * prefixes. Originals live under /originals/ which Storage rules keep
 * private to the owning artist — never read back a public URL for it.
 * Reports aggregate byte progress across all uploads via onProgress.
 */
export async function uploadTrackAssets(
  artistId: string,
  trackId: string,
  files: { master: File; streaming: File; preview: File; djPreview: File | null; artwork: File | null },
  onProgress?: (percent: number) => void,
): Promise<UploadedTrackAssets> {
  const originalPath = `artists/${artistId}/originals/${trackId}.${extOf(files.master)}`
  const streamingPath = `artists/${artistId}/streaming/${trackId}.${extOf(files.streaming)}`
  const previewPath = `artists/${artistId}/previews/${trackId}.${extOf(files.preview)}`
  const djPreviewPath = files.djPreview ? `artists/${artistId}/dj-previews/${trackId}.${extOf(files.djPreview)}` : null

  const uploads: { task: ReturnType<typeof uploadBytesResumable>; total: number }[] = [
    { task: uploadBytesResumable(ref(storage, originalPath), files.master), total: files.master.size },
    { task: uploadBytesResumable(ref(storage, streamingPath), files.streaming), total: files.streaming.size },
    { task: uploadBytesResumable(ref(storage, previewPath), files.preview), total: files.preview.size },
  ]
  if (files.djPreview && djPreviewPath) {
    uploads.push({ task: uploadBytesResumable(ref(storage, djPreviewPath), files.djPreview), total: files.djPreview.size })
  }
  const totalBytes = uploads.reduce((sum, u) => sum + u.total, 0)
  const transferred = new Array(uploads.length).fill(0)

  await Promise.all(
    uploads.map(
      ({ task }, index) =>
        new Promise<void>((resolve, reject) => {
          task.on(
            'state_changed',
            (snapshot) => {
              transferred[index] = snapshot.bytesTransferred
              if (onProgress && totalBytes > 0) {
                onProgress(Math.round((transferred.reduce((a, b) => a + b, 0) / totalBytes) * 100))
              }
            },
            reject,
            () => resolve(),
          )
        }),
    ),
  )

  let artworkURL: string | null = null
  if (files.artwork) {
    const artworkPath = `artists/${artistId}/artwork/${trackId}.${extOf(files.artwork)}`
    const artworkSnap = await uploadBytesResumable(ref(storage, artworkPath), files.artwork)
    artworkURL = await getDownloadURL(artworkSnap.ref)
  }

  return { previewAudioPath: previewPath, streamAudioPath: streamingPath, originalAudioPath: originalPath, djPreviewAudioPath: djPreviewPath, artworkURL }
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
  durationSeconds: number
  durationFormatted: string
  previewEnabled: boolean
  djPreviewStartSec: number | null
  djPreviewDurationSec: number | null
  previewDurationSec: number
  previewStartSec: number
  djPromotion: boolean
  djLicenceMode: LicenceMode
  djFixedPrice: number | null
  /** Legacy audience marker; new uploads use `all`. */
  djPromoTier: 'all' | 'pro_plus_only'
  /** Optional release embargo. */
  embargoUntil: Date | null
  /** Only meaningful when visibility === 'early_access'. */
  followerReleaseAt: Date | null
  publicReleaseAt: Date | null
  rightsMetadata: TrackDoc['rightsMetadata']
}

export async function createTrack(
  artistId: string,
  trackId: string,
  assets: UploadedTrackAssets,
  input: CreateTrackInput,
): Promise<void> {
  const baseSlug = slugify(input.title) || trackId.slice(0, 8)

  const trackSlug = await runTransaction(db, async (tx) => {
    let candidate = baseSlug
    let attempt = 0
    while (attempt < 25) {
      const existing = await tx.get(trackSlugRef(artistId, candidate))
      if (!existing.exists()) break
      attempt += 1
      candidate = `${baseSlug}-${attempt + 1}`
    }
    // Exhausted the suffix range (25 same-titled tracks from one artist) —
    // fall back to no slug rather than blocking the upload; the track still
    // works fine addressed by its raw trackId.
    if (attempt >= 25) return null
    tx.set(trackSlugRef(artistId, candidate), { artistId, trackId })
    return candidate
  })

  const track: Omit<TrackDoc, 'createdAt' | 'updatedAt' | 'releaseDate'> & {
    createdAt: unknown
    updatedAt: unknown
    releaseDate: unknown
  } = {
    trackId,
    artistId,
    title: input.title,
    titleLower: input.title.toLowerCase(),
    ...(trackSlug ? { trackSlug } : {}),
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
    durationSeconds: input.durationSeconds,
    durationFormatted: input.durationFormatted,
    previewEnabled: input.previewEnabled,
    previewAudioPath: assets.previewAudioPath,
    previewDurationSec: input.previewDurationSec,
    previewStartSec: input.previewStartSec,
    djPreviewAudioPath: assets.djPreviewAudioPath,
    djPreviewStartSec: input.djPreviewStartSec,
    djPreviewDurationSec: input.djPreviewDurationSec,
    originalAudioPath: assets.originalAudioPath,
    streamAudioPath: assets.streamAudioPath,
    artworkURL: assets.artworkURL,
    visibility: input.visibility,
    djPromotion: input.djPromotion,
    djLicenceMode: input.djLicenceMode,
    djFixedPrice: input.djFixedPrice,
    djPromoTier: input.djPromoTier,
    embargoUntil: input.embargoUntil ? Timestamp.fromDate(input.embargoUntil) : null,
    followerReleaseAt: input.followerReleaseAt ? Timestamp.fromDate(input.followerReleaseAt) : null,
    publicReleaseAt: input.publicReleaseAt ? Timestamp.fromDate(input.publicReleaseAt) : null,
    playCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    rightsConfirmed: true,
    status: 'published',
    rightsMetadata: input.rightsMetadata,
  }
  await setDoc(trackRef(trackId), track)
}

export async function getTrack(trackId: string): Promise<TrackDoc | null> {
  const snap = await getDoc(trackRef(trackId))
  return snap.exists() ? (snap.data() as TrackDoc) : null
}

export function subscribeTrack(
  trackId: string,
  onChange: (track: TrackDoc | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    trackRef(trackId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as TrackDoc) : null)
    },
    (error) => {
      console.error('[subscribeTrack] listener error:', error)
      onError?.(error)
    },
  )
}

export async function updateTrackDealSettings(trackId: string, settings: TrackDjDealSettings): Promise<void> {
  await updateDoc(trackRef(trackId), { djDealSettings: settings, updatedAt: serverTimestamp() })
}

export interface TrackAccessSettingsInput {
  visibility: TrackVisibility
  previewEnabled: boolean
  previewStartSec: number
  previewDurationSec: number
  /** Only meaningful when visibility === 'early_access'. */
  followerReleaseAt: Date | null
  publicReleaseAt: Date | null
}

/**
 * Fan-facing access settings only — deliberately separate from
 * updateTrackDjAccess/updateTrackDealSettings, since DJ licensing
 * permissions are their own independent system (downloadLicensedTrack
 * never even reads track.visibility) and shouldn't be editable from the
 * same call as fan-streaming access.
 */
export async function updateTrackAccessSettings(trackId: string, input: TrackAccessSettingsInput): Promise<void> {
  await updateDoc(trackRef(trackId), {
    visibility: input.visibility,
    previewEnabled: input.previewEnabled,
    previewStartSec: input.previewStartSec,
    previewDurationSec: input.previewDurationSec,
    followerReleaseAt: input.followerReleaseAt ? Timestamp.fromDate(input.followerReleaseAt) : null,
    publicReleaseAt: input.publicReleaseAt ? Timestamp.fromDate(input.publicReleaseAt) : null,
    updatedAt: serverTimestamp(),
  })
}

/** Rebuilds the real short preview before its timing metadata is changed. */
export async function regenerateTrackPreview(
  track: TrackDoc,
  previewStartSec: number,
  previewDurationSec: number,
): Promise<void> {
  const originalUrl = await getDownloadURL(ref(storage, track.originalAudioPath))
  const response = await fetch(originalUrl)
  if (!response.ok) throw new Error('The original audio could not be opened to rebuild the preview.')
  const blob = await response.blob()
  const extension = track.originalAudioPath.split('.').pop() || 'mp3'
  const master = new File([blob], `master.${extension}`, { type: blob.type || track.mimeType || 'audio/mpeg' })
  const derivative = await derivePreviewAsset(master, { previewStartSec, previewDurationSec })
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, track.previewAudioPath), derivative.file)
    task.on('state_changed', undefined, reject, () => resolve())
  })
}

/** The core DJ-access toggle — set at upload time, but also editable afterwards from Music. */
export async function updateTrackDjAccess(
  trackId: string,
  settings: { djPromotion: boolean; djLicenceMode: LicenceMode; djFixedPrice: number | null },
): Promise<void> {
  await updateDoc(trackRef(trackId), { ...settings, updatedAt: serverTimestamp() })
}

export async function getPreviewPlaybackURL(track: TrackDoc): Promise<string> {
  const fn = httpsCallable<{ trackId: string; kind: 'preview' }, { url: string }>(functions, 'getTrackPlaybackUrl')
  return (await fn({ trackId: track.trackId, kind: 'preview' })).data.url
}

export async function getDjPreviewPlaybackURL(track: TrackDoc): Promise<string> {
  const fn = httpsCallable<{ trackId: string; kind: 'dj_preview' }, { url: string }>(functions, 'getTrackPlaybackUrl')
  return (await fn({ trackId: track.trackId, kind: 'dj_preview' })).data.url
}

/** Full-length optimised playback for entitled listeners — visibility-gated the same as the track itself. */
export async function getStreamPlaybackURL(track: TrackDoc): Promise<string> {
  const fn = httpsCallable<{ trackId: string; kind: 'stream' }, { url: string }>(functions, 'getTrackPlaybackUrl')
  return (await fn({ trackId: track.trackId, kind: 'stream' })).data.url
}

export async function deleteTrack(trackId: string): Promise<void> {
  const fn = httpsCallable(functions, 'deleteTrack')
  await fn({ trackId })
}

export async function listNewReleases(count = 20): Promise<TrackDoc[]> {
  const q = query(
    collection(db, 'tracks'),
    where('visibility', 'in', ['public', 'followers', 'supporters', 'early_access']),
    orderBy('createdAt', 'desc'),
    limit(count),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => d.data() as TrackDoc)
    .filter((track) => track.takenDown !== true && (track.status === undefined || track.status === 'published') && !track.restrictedCapabilities?.includes('discovery'))
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
 * A track can accept a direct DJ enquiry without an artist-created deal.
 * Per-track deal settings override the older promotion/licence switches.
 */
export function isTrackAcceptingDjRequests(track: TrackDoc): boolean {
  if (track.takenDown || track.restrictedCapabilities?.includes('dj_licensing')) return false
  if (track.djDealSettings) return track.djDealSettings.acceptDjRequests
  return track.djPromotion && track.djLicenceMode !== 'not_available'
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
  const constraints = [where('visibility', 'in', visibilities)]

  // Pull a bounded discovery window, then apply requestability and optional
  // filters together. This includes tracks opened through the newer manual-
  // approval setting even when the legacy djPromotion flag is false.
  const q = query(collection(db, 'tracks'), ...constraints, orderBy('createdAt', 'desc'), limit(Math.max(opts.count ?? 100, 100)))
  const snap = await getDocs(q)
  const now = Date.now()

  return snap.docs
    .map((d) => d.data() as TrackDoc)
    .filter(isTrackAcceptingDjRequests)
    .filter((t) => t.embargoUntil == null || t.embargoUntil.toMillis() <= now)
    .filter((t) => opts.includeProPlusOnly || t.djPromoTier === 'all')
    .filter((t) => !filters.genre || t.genre === filters.genre)
    .filter((t) => !filters.mood || t.mood === filters.mood)
    .filter((t) => !filters.key || t.key === filters.key)
    .filter((t) => !filters.licenceMode || t.djLicenceMode === filters.licenceMode)
    .filter((t) => !filters.location || t.location === filters.location)
    .filter((t) => filters.bpmMin == null || (t.bpm != null && t.bpm >= filters.bpmMin))
    .filter((t) => filters.bpmMax == null || (t.bpm != null && t.bpm <= filters.bpmMax))
    .slice(0, opts.count ?? 100)
}

/** Convenience query for DJ discovery. */
export async function listDJPromotionTracks(count = 20): Promise<TrackDoc[]> {
  return listDJPromotionTracksFiltered({}, { includeProPlusOnly: true, includeDjOnly: true, count })
}

/** Server-side play counting keeps play counts out of reach of client tampering. */
export async function recordTrackPlay(
  trackId: string,
  kind: 'preview' | 'dj_preview' | 'stream',
  event: 'start' | 'completion' = 'start',
): Promise<void> {
  const fn = httpsCallable(functions, 'recordTrackPlay')
  await fn({ trackId, kind, event })
}
