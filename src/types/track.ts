import type { Timestamp } from 'firebase/firestore'
import type { TrackDjDealSettings } from './deal'

export type TrackVisibility =
  | 'public'
  | 'followers'
  | 'supporters'
  | 'early_access'
  | 'dj_only'
  | 'private'

export type LicenceMode = 'free' | 'fixed_price' | 'custom_price' | 'negotiated' | 'not_available'

export interface TrackCredits {
  songwriters: string[]
  producers: string[]
  featuredArtists: string[]
}

export interface TrackDoc {
  trackId: string
  artistId: string
  title: string
  /** Lowercased copy of `title`, kept in sync for prefix search. */
  titleLower: string
  /**
   * Clean per-artist-unique slug for /artist/:slug/track/:trackSlug links,
   * reserved via the `trackSlugs` registry at creation time. Optional
   * because tracks created before this field existed have none — those
   * keep working forever via their raw trackId in the same route param.
   */
  trackSlug?: string
  /** Server-maintained (recordTrackView) page-view count — distinct from playCount (actual preview playback). */
  viewCount?: number
  albumId: string | null
  genre: string
  subgenre: string | null
  bpm: number | null
  mood: string | null
  releaseDate: Timestamp | null
  description: string
  explicit: boolean
  credits: TrackCredits
  /** Best-effort, read client-side from the YouTube player once it loads — never authoritative, never required. */
  durationSeconds?: number
  durationFormatted?: string
  artworkURL: string | null
  visibility: TrackVisibility
  djPromotion: boolean
  djLicenceMode: LicenceMode
  djFixedPrice: number | null
  /** Camelot notation (e.g. '8A') for harmonic-mixing filters. */
  key: string | null
  /** Denormalized copy of the artist's ArtistProfile.location at upload time, so location filtering needs no join. */
  location: string | null
  /** Legacy audience marker; new uploads are available to all DJs. */
  djPromoTier: 'all' | 'pro_plus_only'
  /** Hidden from DJ discovery and requests until this date passes. */
  embargoUntil: Timestamp | null
  /** Only meaningful when visibility === 'early_access'. Supporters always get full access immediately; followers unlock once this date passes. Server-timestamp-checked, never the caller's clock. */
  followerReleaseAt?: Timestamp | null
  /** Only meaningful when visibility === 'early_access'. When set and passed, the track behaves as fully public — optional, defaults to never. */
  publicReleaseAt?: Timestamp | null
  /** Count of times an entitled viewer opened this track's YouTube link/embed. Never a claimed YouTube view count. */
  playCount: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  rightsConfirmed: boolean
  status?: 'published' | 'unpublished'
  takenDown?: boolean
  /** Free-text ownership/rights context an artist provides — evidence, not proof. */
  rightsMetadata?: TrackRightsMetadata
  /** Capabilities temporarily withheld by an admin during a copyright review — never all-or-nothing like takenDown. */
  restrictedCapabilities?: RestrictedCapability[]
  /** Finer-grained DJ deal configuration layered on top of djPromotion/djLicenceMode. */
  djDealSettings?: TrackDjDealSettings
  /** Admin/backend-only: blocks automatic retention cleanup from touching this track. */
  legalHold?: boolean
}

export type RestrictedCapability = 'dj_licensing' | 'discovery' | 'streaming' | 'sharing'

export interface TrackRightsMetadata {
  ownsMasterRecording: 'yes' | 'no' | 'shared' | 'licensed'
  ownsComposition: 'yes' | 'no' | 'shared' | 'licensed' | 'not_sure'
  containsSamples: boolean
  hasFeaturedArtists: boolean
  hasProducers: boolean
  hasSongwriters: boolean
  isCoverOrInterpolation: boolean
  hasLabelInvolvement: boolean
  hasPublisherInvolvement: boolean
  hasOtherRightsHolders: boolean
  masterOwner: string | null
  publisher: string | null
  label: string | null
  pro: string | null
  isrc: string | null
  iswc: string | null
  copyrightNotice: string | null
}

export interface AlbumDoc {
  albumId: string
  artistId: string
  title: string
  type: 'album' | 'ep' | 'single'
  artworkURL: string | null
  releaseDate: Timestamp | null
  createdAt: Timestamp | null
}
