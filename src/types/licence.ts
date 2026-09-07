import type { Timestamp } from 'firebase/firestore'

export type IntendedUse =
  | 'live_club_performance'
  | 'festival_performance'
  | 'radio_show'
  | 'dj_set'
  | 'promotional_mix'
  | 'online_stream'
  | 'other'

export type LicenceRequestStatus =
  | 'submitted'
  | 'artist_review'
  | 'negotiating'
  | 'agreement_ready'
  | 'awaiting_signatures'
  | 'awaiting_payment'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled'

export interface LicenceRequestDoc {
  requestId: string
  djId: string
  artistId: string
  trackId: string
  /** Denormalized from the track at submission time, so DJ analytics can group by genre without N+1 reads. */
  trackGenre: string
  intendedUse: IntendedUse
  territory: string | null
  expectedDate: string | null
  venue: string | null
  message: string
  status: LicenceRequestStatus
  conversationId: string
  currentAgreementId?: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface DownloadLogDoc {
  djId: string
  artistId: string
  trackId: string
  agreementId: string
  fileVersion: number
  timestamp: Timestamp | null
}

export type AgreementStatus = 'pending' | 'signed' | 'superseded'

export interface LicenceAgreementDoc {
  agreementId: string
  licenceRequestId: string
  artistId: string
  djId: string
  trackId: string
  trackVersion: number
  permittedUse: string
  territory: string
  startDate: string
  expiryDate: string | null
  licenceFeeMinor: number
  currency: string
  platformFeePercent?: number
  platformFeeMinor?: number
  artistNetMinor?: number
  attributionRequirements: string
  recordingPermission: boolean
  streamingPermission: boolean
  commercialUse: boolean
  redistributionAllowed: boolean
  resaleAllowed: boolean
  additionalTerms: string
  agreementVersion: number
  status: AgreementStatus
  artistAcceptedAt: Timestamp | null
  djAcceptedAt: Timestamp | null
  paidAt: Timestamp | null
  downloadRevoked: boolean
  downloadCount: number
  createdAt: Timestamp | null
  finalisedAt: Timestamp | null
}
