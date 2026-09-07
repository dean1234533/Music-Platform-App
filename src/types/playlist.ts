import type { Timestamp } from 'firebase/firestore'

export interface PlaylistDoc {
  playlistId: string
  ownerId: string
  title: string
  trackIds: string[]
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}
