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
  | 'accepted'
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
  trackTitleSnapshot?: string
  artistNameSnapshot?: string
  djNameSnapshot?: string
  selectedDealSnapshot?: {
    dealId?: string | null
    name: string
    description: string
    priceType: 'free' | 'fixed' | 'starting_from' | 'negotiable' | 'custom_quote'
    priceMinor: number
    currency: string
    permittedUse: string
    territory: string
    durationDays: number | null
    recordingPermission: boolean
    streamingPermission: boolean
    promotionalMixPermission: boolean
    remixPermission: boolean
    redistributionPermission: boolean
    resalePermission: boolean
    attributionRequirements: string
    additionalTerms: string
  } | null
  requestedStartDate?: string | null
  requestedEndDate?: string | null
  recordingIntention?: boolean
  streamingIntention?: boolean
  status: LicenceRequestStatus
  /** Present only on legacy requests created before licensing chat was removed. */
  conversationId?: string
  currentAgreementId?: string
  currentOfferId?: string
  /** Admin/backend-only: blocks automatic retention cleanup from touching this request. */
  legalHold?: boolean
  /** uids who removed this closed request from their own list — the doc and the other party's view are untouched. */
  dismissedBy?: string[]
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
  /** Optional deadline for accepting this specific offer (distinct from the licence's own expiryDate). Null = never expires. */
  offerExpiresAt: Timestamp | null
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
  | 'ready_for_signature'
  | 'artist_signed'
  | 'dj_signed'
  | 'fully_signed'
  | 'awaiting_payment'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'void'
  | 'superseded'

export interface LicenceAgreementDoc {
  agreementId: string
  requestId?: string
  licenceRequestId: string
  artistId: string
  djId: string
  trackId: string
  trackVersion: number
  acceptedOfferId?: string | null
  sourceDealId?: string | null
  trackTitleSnapshot?: string
  artistNameSnapshot?: string
  djNameSnapshot?: string
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

export interface LicenceRequestEventDoc {
  eventId: string
  requestId: string
  type: string
  actorId: string | null
  actorRole: 'artist' | 'dj' | 'system'
  summary: string
  agreementId?: string | null
  offerId?: string | null
  createdAt: Timestamp | null
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
