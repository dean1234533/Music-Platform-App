import type { Timestamp } from 'firebase/firestore'

export type CopyrightClaimStatus = 'submitted' | 'under_review' | 'action_required' | 'removed' | 'restored' | 'rejected'

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
}

export interface ReportDoc {
  reportId: string
  reporterId: string
  targetType: 'track' | 'artist' | 'dj' | 'user' | 'message' | 'post'
  targetId: string
  reason: string
  description: string
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: Timestamp | null
}

export interface VerificationRequestDoc {
  verificationRequestId: string
  userId: string
  profileType: 'artist' | 'dj'
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Timestamp | null
}

export interface AuditLogDoc {
  adminId: string
  action: string
  details: Record<string, unknown>
  createdAt: Timestamp | null
}
