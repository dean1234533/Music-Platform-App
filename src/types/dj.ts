import type { Timestamp } from 'firebase/firestore'
import type { SocialLinks } from './artist'

export type DJVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

export interface DJProfile {
  djId: string
  name: string
  realName: string | null
  photoURL: string | null
  coverURL: string | null
  bio: string
  genres: string[]
  country: string
  city: string
  venues: string[]
  website: string | null
  socialLinks: SocialLinks
  verificationStatus: DJVerificationStatus
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}
