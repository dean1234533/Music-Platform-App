import type { Timestamp } from 'firebase/firestore'

export interface CrateDoc {
  crateId: string
  ownerId: string
  title: string
  trackIds: string[]
  /** Free-text notes, e.g. set order or cue notes. */
  notes: string | null
  /** Free-form tags, e.g. "warm-up", "peak-time". */
  tags: string[]
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}
