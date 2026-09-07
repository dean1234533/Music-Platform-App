import type { Timestamp } from 'firebase/firestore'

export interface CrateDoc {
  crateId: string
  ownerId: string
  title: string
  trackIds: string[]
  /** Pro+ ("advanced crates") — free-text notes, e.g. set order/cue notes. */
  notes: string | null
  /** Pro+ ("advanced crates") — free-form tags, e.g. "warm-up", "peak-time". */
  tags: string[]
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}
