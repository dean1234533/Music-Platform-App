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
  | 'offer_sent'
  | 'counter_offer'
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
  /** Set when the DJ requested a specific artist-created deal rather than a fully custom negotiation. */
  dealId?: string | null
  requestedStartDate?: string | null
  requestedEndDate?: string | null
  recordingIntention?: boolean
  streamingIntention?: boolean
  status: LicenceRequestStatus
  conversationId: string
  currentAgreementId?: string
  currentOfferId?: string
  /** Admin/backend-only: blocks automatic retention cleanup from touching this request. */
  legalHold?: boolean
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn' | 'expired'

export interface LicenceOfferDoc {
  offerId: string
  requestId: string
  trackId: string
  artistId: string
  djId: string
  priceMinor: number
  currency: string
  permittedUse: string
  territory: string
  startDate: string
  expiryDate: string | null
  recordingPermission: boolean
  streamingPermission: boolean
  promotionalMixPermission: boolean
  attributionRequirements: string
  redistributionAllowed: boolean
  resaleAllowed: boolean
  remixAllowed: boolean
  additionalTerms: string
  createdBy: string
  createdByRole: 'artist' | 'dj'
  createdAt: Timestamp | null
  status: OfferStatus
  version: number
  supersededByOfferId?: string | null
}

export interface DownloadLogDoc {
  djId: string
  artistId: string
  trackId: string
  agreementId: string
  fileVersion: number
  timestamp: Timestamp | null
}

export type AgreementStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'void'
  | 'superseded'

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
  promotionalMixPermission?: boolean
  commercialUse: boolean
  redistributionAllowed: boolean
  resaleAllowed: boolean
  remixAllowed?: boolean
  additionalTerms: string
  rightsHolderDeclaration?: boolean
  agreementVersion: number
  /** SHA-256 fingerprint of the frozen terms, computed server-side — see functions/src/licensing/agreements.ts. */
  contentHash?: string
  status: AgreementStatus
  artistAcceptedAt: Timestamp | null
  djAcceptedAt: Timestamp | null
  artistLegalName?: string | null
  djLegalName?: string | null
  paidAt: Timestamp | null
  downloadRevoked: boolean
  downloadCount: number
  /** Admin/backend-only: blocks automatic retention cleanup from touching this agreement. */
  legalHold?: boolean
  createdAt: Timestamp | null
  finalisedAt: Timestamp | null
}

export interface LicenceAgreementAcceptanceDoc {
  acceptanceId: string
  agreementId: string
  userId: string
  role: 'artist' | 'dj'
  legalName: string
  signatureType: 'typed' | 'drawn'
  signatureReference: string
  authorityConfirmed: boolean
  agreementVersion: number
  agreementContentHash?: string | null
  ipAddress: string | null
  userAgent: string | null
  acceptedAt: Timestamp | null
}
