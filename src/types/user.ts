import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'fan' | 'artist' | 'dj' | 'admin'

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled'

export interface NotificationPreferences {
  email: boolean
  inApp: boolean
}

export interface UserProfile {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  roles: UserRole[]
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  onboardingComplete: boolean
  subscriptionStatus: SubscriptionStatus
  artistMembershipStatus?: SubscriptionStatus
  notificationPreferences: NotificationPreferences
  stripeCustomerId?: string
  suspended?: boolean
  fcmTokens?: string[]
}
