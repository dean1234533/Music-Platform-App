import type { Timestamp } from 'firebase/firestore'

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
  albumId: string | null
  genre: string
  subgenre: string | null
  bpm: number | null
  mood: string | null
  releaseDate: Timestamp | null
  description: string
  explicit: boolean
  credits: TrackCredits
  /** Storage path under /artists/{artistId}/previews/ — safe for public playback */
  previewAudioPath: string
  previewDurationSec: number
  previewStartSec: number
  /** Storage path under /artists/{artistId}/originals/ — never exposed publicly */
  originalAudioPath: string
  artworkURL: string | null
  visibility: TrackVisibility
  djPromotion: boolean
  djLicenceMode: LicenceMode
  djFixedPrice: number | null
  playCount: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  rightsConfirmed: boolean
  takenDown?: boolean
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
