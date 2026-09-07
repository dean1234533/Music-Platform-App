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
