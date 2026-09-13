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
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { db, functions, storage } from '@/lib/firebase'
import type { LicenceMode, TrackCredits, TrackDoc, TrackVisibility } from '@/types/track'
import type { TrackDjDealSettings } from '@/types/deal'
import { slugify } from '@/utils/slug'

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

/** Uploads only cover artwork now — there is no hosted audio of any kind. */
export async function uploadTrackArtworkAsset(artistId: string, trackId: string, artwork: File | null): Promise<string | null> {
  if (!artwork) return null
  const artworkPath = `artists/${artistId}/artwork/${trackId}.${extOf(artwork)}`
  const snap = await uploadBytesResumable(ref(storage, artworkPath), artwork)
  return getDownloadURL(snap.ref)
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
  youtubeVideoId: string
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

/**
 * Track creation is a Cloud Function (createTrack), not a direct client
 * write — the actual YouTube video ID has to land in trackMedia/{trackId}
 * (never client-readable/writable, see firestore.rules) atomically with the
 * public tracks/{trackId} doc, which only the Admin SDK can do in one step.
 * trackSlugs reservation stays a direct client write since it's not
 * sensitive (just a slug->trackId registry the artist already owns).
 */
export async function createTrack(
  artistId: string,
  trackId: string,
  artworkURL: string | null,
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

  const fn = httpsCallable(functions, 'createTrack')
  await fn({
    trackId,
    trackSlug,
    youtubeVideoId: input.youtubeVideoId,
    title: input.title,
    genre: input.genre,
    subgenre: input.subgenre,
    bpm: input.bpm,
    mood: input.mood,
    key: input.key,
    location: input.location,
    description: input.description,
    explicit: input.explicit,
    albumId: input.albumId,
    credits: input.credits,
    artworkURL,
    visibility: input.visibility,
    djPromotion: input.djPromotion,
    djLicenceMode: input.djLicenceMode,
    djFixedPrice: input.djFixedPrice,
    embargoUntil: input.embargoUntil ? input.embargoUntil.toISOString() : null,
    followerReleaseAt: input.followerReleaseAt ? input.followerReleaseAt.toISOString() : null,
    publicReleaseAt: input.publicReleaseAt ? input.publicReleaseAt.toISOString() : null,
    rightsMetadata: input.rightsMetadata,
    rightsConfirmed: true,
  })
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

export interface TrackDetailsInput {
  title: string
  genre: string
  subgenre: string | null
  bpm: number | null
  mood: string | null
  key: string | null
  description: string
  explicit: boolean
  credits: TrackCredits
}

/**
 * Editable metadata only — never audio/Storage paths, visibility, or any of
 * the other fields firestore.rules freezes on update. artworkURL is passed
 * separately (only present when the artist actually chose a new image) so a
 * details-only edit never touches it.
 */
export async function updateTrackDetails(trackId: string, input: TrackDetailsInput, artworkURL?: string): Promise<void> {
  await updateDoc(trackRef(trackId), {
    ...input,
    titleLower: input.title.toLowerCase(),
    ...(artworkURL ? { artworkURL } : {}),
    updatedAt: serverTimestamp(),
  })
}

/** Re-uploads cover artwork to the same owner-only Storage path used at creation, overwriting it. */
export async function uploadTrackArtwork(artistId: string, trackId: string, file: File): Promise<string> {
  const artworkPath = `artists/${artistId}/artwork/${trackId}.${extOf(file)}`
  const snap = await uploadBytesResumable(ref(storage, artworkPath), file)
  return getDownloadURL(snap.ref)
}

export async function updateTrackDealSettings(trackId: string, settings: TrackDjDealSettings): Promise<void> {
  await updateDoc(trackRef(trackId), { djDealSettings: settings, updatedAt: serverTimestamp() })
}

const DEFAULT_DEAL_SETTINGS: TrackDjDealSettings = {
  acceptDjRequests: true,
  allowedDealIds: [],
  defaultDealId: null,
  minimumPriceMinor: null,
  verifiedDjsOnly: false,
  customApprovalRequired: false,
}

/**
 * Assigns/unassigns one deal on one track without disturbing the track's other deal settings
 * (minimumPriceMinor, verifiedDjsOnly, etc.) or its other assigned deals — lets a deal be
 * reassigned across tracks directly from the deal-centric DJ Deals page, not only from each
 * track's own settings modal. Assigning also turns acceptDjRequests on, since checking this
 * box only makes sense if the artist wants the deal live; unassigning leaves it as-is (other
 * deals or manual-approval requests on that track may still be wanted).
 */
export async function toggleDealOnTrack(track: TrackDoc, dealId: string, assign: boolean): Promise<void> {
  const current = track.djDealSettings ?? DEFAULT_DEAL_SETTINGS
  const allowedDealIds = assign
    ? [...new Set([...current.allowedDealIds, dealId])]
    : current.allowedDealIds.filter((id) => id !== dealId)
  await updateTrackDealSettings(track.trackId, {
    ...current,
    allowedDealIds,
    acceptDjRequests: assign ? true : current.acceptDjRequests,
  })
}

export interface TrackAccessSettingsInput {
  visibility: TrackVisibility
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
    followerReleaseAt: input.followerReleaseAt ? Timestamp.fromDate(input.followerReleaseAt) : null,
    publicReleaseAt: input.publicReleaseAt ? Timestamp.fromDate(input.publicReleaseAt) : null,
    updatedAt: serverTimestamp(),
  })
}

/** The core DJ-access toggle — set at upload time, but also editable afterwards from Music. */
export async function updateTrackDjAccess(
  trackId: string,
  settings: { djPromotion: boolean; djLicenceMode: LicenceMode; djFixedPrice: number | null },
): Promise<void> {
  await updateDoc(trackRef(trackId), { ...settings, updatedAt: serverTimestamp() })
}

/**
 * Returns the validated YouTube video ID for this track once the server has
 * checked the same visibility/entitlement ladder used everywhere else
 * (owner/admin/public/follower/supporter/DJ). We never trust the client's
 * own copy of `track.youtubeVideoId` for a non-public track — it's still
 * possible to read the Firestore doc if rules allow the field, but every
 * player call goes through this so a future visibility tightening is
 * enforced without depending on every read site checking it itself.
 */
export async function getTrackYoutubeInfo(
  track: TrackDoc,
): Promise<{ youtubeVideoId: string; youtubeUrl: string; previewOnly?: boolean; previewSeconds?: number }> {
  const fn = httpsCallable<
    { trackId: string },
    { youtubeVideoId: string; youtubeUrl: string; previewOnly?: boolean; previewSeconds?: number }
  >(functions, 'getTrackYoutubeInfo')
  return (await fn({ trackId: track.trackId })).data
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
  // DJ promotion is deliberately independent of fan-facing visibility (the
  // same reason TrackDjAccessModal is a separate flow from
  // TrackAccessSettingsModal) — a followers/supporters/early_access track
  // can still be wide open for DJ licensing. Restricting this query to only
  // 'public' (and 'dj_only') tracks meant an artist's DJ promo on any other
  // tier was invisible to every DJ (user-reported), even though
  // isTrackAcceptingDjRequests below was already correctly evaluating it —
  // the track just never reached that check because this query excluded it
  // first. 'private' stays excluded: nobody outside the owner should
  // discover it via any channel.
  const baseVisibilities = ['public', 'followers', 'supporters', 'early_access']
  const visibilities = opts.includeDjOnly ? [...baseVisibilities, 'dj_only'] : baseVisibilities
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

/** Server-side view counting keeps counts out of reach of client tampering. */
export async function recordTrackPlay(trackId: string): Promise<void> {
  const fn = httpsCallable(functions, 'recordTrackPlay')
  await fn({ trackId })
}
