import type { Timestamp } from 'firebase/firestore'

export interface SocialLinks {
  website?: string
  instagram?: string
  tiktok?: string
  youtube?: string
  spotify?: string
  soundcloud?: string
  x?: string
}

export type DJRequestPolicy = 'anyone' | 'verified_only' | 'approved_only' | 'disabled'

export interface ArtistProfile {
  artistId: string
  slug: string
  name: string
  /** Lowercased copy of `name`, kept in sync for prefix search. */
  nameLower: string
  bio: string
  genres: string[]
  location: string
  socialLinks: SocialLinks
  photoURL: string | null
  coverURL: string | null
  verified: boolean
  followerCount: number
  supporterCount: number
  djAllowRequests: DJRequestPolicy
  /** Server-maintained running total (Cloud Function trigger on track create/delete). */
  trackCount: number
  /** Free-text benefits the artist offers paying supporters. */
  perks: string[]
  /** Independent of djAllowRequests — whether this artist's DJ-tier Stories are visible to DJs at all. */
  storiesDjEnabled: boolean
  /** Server-maintained (recordProfileView). Coarse rate-limited count, not a unique-visitor count — matches trackCount/playCount precision elsewhere. */
  profileViews?: number
  /** Server-maintained (recordProfileView). Sanitized ?ref= source -> count, capped to a bounded number of distinct sources; overflow buckets into 'other'. */
  referralViews?: Record<string, number>
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface ArtistPost {
  postId: string
  artistId: string
  visibility: 'everyone' | 'followers' | 'supporters'
  type: 'text' | 'audio' | 'image' | 'video' | 'poll'
  title: string
  body: string
  mediaURL: string | null
  createdAt: Timestamp | null
}
