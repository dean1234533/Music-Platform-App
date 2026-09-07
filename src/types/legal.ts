import type { Timestamp } from 'firebase/firestore'

export type LegalDocType = 'terms' | 'privacy' | 'copyright_policy' | 'dj_licensing_terms' | 'rights_declaration'

export interface LegalAcceptanceDoc {
  userId: string
  docType: LegalDocType
  version: string
  trackId?: string
  acceptedAt: Timestamp | null
}
