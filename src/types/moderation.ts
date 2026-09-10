import type { Timestamp } from 'firebase/firestore'
import type { RestrictedCapability } from './track'

export type CopyrightClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'information_required'
  | 'artist_notified'
  | 'temporarily_restricted'
  | 'removed'
  | 'rejected'
  | 'resolved'
  | 'restored'
  | 'appealed'
  | 'counter_noticed'

/** Statuses that still need admin/artist attention — excludes the closed-out terminal ones (rejected, resolved, restored). */
export const OPEN_CLAIM_STATUSES: CopyrightClaimStatus[] = [
  'submitted',
  'under_review',
  'information_required',
  'artist_notified',
  'temporarily_restricted',
  'removed',
  'appealed',
  'counter_noticed',
]

export interface CopyrightClaimDoc {
  claimId: string
  reporterId: string
  trackId: string
  artistId: string
  reason: string
  description: string
  status: CopyrightClaimStatus
  adminNote?: string | null
  createdAt: Timestamp | null
  reviewedAt?: Timestamp | null
  reviewedBy?: string | null
  // Claimant identity — collected separately from the authenticated
  // reporterId since the claimant may be filing on behalf of someone else.
  claimantName?: string | null
  claimantEmail?: string | null
  claimantCompany?: string | null
  claimantIsOwnerOrRep?: boolean
  claimedRights?: string | null
  supportingLinks?: string[]
  evidenceUrls?: string[]
  declarationSignature?: string | null
  declaredAt?: Timestamp | null
  restrictedCapabilities?: RestrictedCapability[]
  artistResponse?: string | null
  artistRespondedAt?: Timestamp | null
  counterNoticeText?: string | null
  counterNoticeSubmittedAt?: Timestamp | null
}

export interface ReportDoc {
  reportId: string
  reporterId: string
  targetType: 'track' | 'artist' | 'dj' | 'user' | 'post' | 'story' | 'agreement'
  targetId: string
  reason: string
  description: string
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: Timestamp | null
}

/** A general "I have an issue" message — not tied to a piece of content, unlike ReportDoc. */
export interface SupportMessageDoc {
  supportMessageId: string
  userId: string
  userEmail: string | null
  userName: string | null
  subject: string
  message: string
  status: 'open' | 'resolved'
  createdAt: Timestamp | null
  reply?: string | null
  repliedAt?: Timestamp | null
  resolvedBy?: string | null
  resolvedAt?: Timestamp | null
}

export interface VerificationRequestDoc {
  verificationRequestId: string
  userId: string
  profileType: 'artist' | 'dj'
  status: 'pending' | 'approved' | 'rejected'
  /** The requester's own case for why they should be verified — an admin previously had nothing but a raw uid to go on. */
  note: string
  reviewedBy?: string
  reviewedAt?: Timestamp | null
  createdAt: Timestamp | null
}

export interface AuditLogDoc {
  adminId: string
  action: string
  details: Record<string, unknown>
  createdAt: Timestamp | null
}
