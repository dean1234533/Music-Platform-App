import type { Timestamp } from 'firebase/firestore'

export type NotificationType =
  | 'artist_release'
  | 'exclusive_track'
  | 'early_access'
  | 'new_supporter_post'
  | 'livestream'
  | 'event'
  | 'new_follower'
  | 'new_supporter'
  | 'fan_offer'
  | 'artist_promo'
  | 'dj_request'
  | 'dj_message'
  | 'agreement_signed'
  | 'dj_licence_payment'
  | 'payout_update'
  | 'request_approved'
  | 'request_rejected'
  | 'request_cancelled'
  | 'counter_offer'
  | 'offer_sent'
  | 'new_message'
  | 'agreement_ready'
  | 'artist_signed'
  | 'dj_signed'
  | 'agreement_voided'
  | 'payment_required'
  | 'download_unlocked'
  | 'licence_expiring'
  | 'contract_expired'
  | 'verification_update'
  | 'copyright_claim_update'

export interface NotificationDoc {
  notificationId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  linkTo: string | null
  read: boolean
  createdAt: Timestamp | null
}
