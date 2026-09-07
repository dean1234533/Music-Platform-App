import type { Timestamp } from 'firebase/firestore'
import type { SocialLinks } from './artist'
import type { PlanTier } from './entitlements'

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
  /** Server-maintained; lazily reset when a new calendar month starts. */
  requestsThisMonth: number
  requestsMonthResetAt: Timestamp | null
  /** Server-mirrored from the DJ's resolved plan tier. */
  planTier: PlanTier
  /** DJ's own opt-in to receive Artist Pro+ bulk promotional outreach. Defaults to false — never opt DJs in automatically. */
  bulkOutreachOptIn: boolean
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}
