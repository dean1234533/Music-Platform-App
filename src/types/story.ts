import type { Timestamp } from 'firebase/firestore'

export type StoryMediaKind = 'image' | 'video' | 'audio' | 'text' | 'poll'

export type StoryCategory =
  | 'studio_clip'
  | 'gig_announcement'
  | 'new_song_teaser'
  | 'behind_the_scenes'
  | 'shoutout'
  | 'poll_question'
  | 'other'

export type StoryVisibility = 'public' | 'followers' | 'supporters' | 'dj'

/** CTA targets are restricted to these enumerated, server-validated destinations — never an arbitrary URL. */
export type StoryCtaType = 'track' | 'follow' | 'support'

export interface StoryPollOption {
  id: string
  label: string
}

export interface StoryDoc {
  storyId: string
  artistId: string
  mediaKind: StoryMediaKind
  storyCategory: StoryCategory
  mediaUrl: string | null
  mediaStoragePath?: string | null
  caption: string
  visibility: StoryVisibility
  createdAt: Timestamp | null
  expiresAt: Timestamp | null
  durationSec: number
  ctaType: StoryCtaType | null
  /** trackId when ctaType === 'track'; unused (artistId is already known) for 'follow'/'support'. */
  ctaTargetId: string | null
  isHighlight: boolean
  highlightGroup: string | null
  uniqueViewerCount: number
  reactionCount: number
  ctaClickCount: number
  pollOptions: StoryPollOption[]
  pollVoteCounts: Record<string, number>
}

export interface StoryViewDoc {
  storyId: string
  userId: string
  viewedAt: Timestamp | null
}

export interface StoryReactionDoc {
  storyId: string
  userId: string
  emoji: string
  createdAt: Timestamp | null
}

export interface StoryPollVoteDoc {
  storyId: string
  userId: string
  optionId: string
  votedAt: Timestamp | null
}
