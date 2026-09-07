import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { userHasRole } from '../roles.js'

// Mirrors src/constants/mediaConfig.ts's STORY_* constants — rules/Functions
// can't import client TS, so these are hand-kept-in-sync (same convention
// already used for storage.rules' size/type literals).
const STORY_DEFAULT_DURATION_HOURS = 24
const STORY_MAX_DURATION_HOURS = 168
const STORY_MAX_DURATION_SEC = 60

const MEDIA_KINDS = ['image', 'video', 'audio', 'text', 'poll'] as const
const CATEGORIES = [
  'studio_clip',
  'gig_announcement',
  'new_song_teaser',
  'behind_the_scenes',
  'shoutout',
  'poll_question',
  'other',
] as const
const VISIBILITIES = ['public', 'followers', 'supporters', 'dj'] as const
const CTA_TYPES = ['track', 'follow', 'support'] as const

/**
 * CTA targets are restricted to enumerated, server-validated destinations —
 * never an arbitrary URL from the client — so a Story can never be used as
 * an open redirect. 'track' is the only type that needs its target checked
 * against a real record the artist actually owns.
 */
export const createStory = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const artistId = request.auth.uid
  if (!(await userHasRole(artistId, 'artist'))) {
    throw new HttpsError('permission-denied', 'Only artists can post Stories.')
  }

  const {
    mediaKind,
    storyCategory,
    mediaUrl,
    mediaStoragePath,
    caption,
    visibility,
    durationSec,
    expiresInHours,
    ctaType,
    ctaTargetId,
    pollOptions,
  } = request.data ?? {}

  if (!MEDIA_KINDS.includes(mediaKind)) throw new HttpsError('invalid-argument', 'Invalid mediaKind.')
  if (!CATEGORIES.includes(storyCategory)) throw new HttpsError('invalid-argument', 'Invalid storyCategory.')
  if (!VISIBILITIES.includes(visibility)) throw new HttpsError('invalid-argument', 'Invalid visibility.')
  if (mediaKind !== 'text' && mediaKind !== 'poll' && (!mediaUrl || typeof mediaUrl !== 'string')) {
    throw new HttpsError('invalid-argument', 'mediaUrl is required for this mediaKind.')
  }

  let resolvedCtaType: (typeof CTA_TYPES)[number] | null = null
  let resolvedCtaTargetId: string | null = null
  if (ctaType != null) {
    if (!CTA_TYPES.includes(ctaType)) throw new HttpsError('invalid-argument', 'Invalid ctaType.')
    resolvedCtaType = ctaType
    if (ctaType === 'track') {
      if (!ctaTargetId || typeof ctaTargetId !== 'string') {
        throw new HttpsError('invalid-argument', 'ctaTargetId is required for a track CTA.')
      }
      const trackSnap = await db.collection('tracks').doc(ctaTargetId).get()
      if (!trackSnap.exists || trackSnap.data()?.artistId !== artistId) {
        throw new HttpsError('invalid-argument', 'ctaTargetId must be one of your own tracks.')
      }
      resolvedCtaTargetId = ctaTargetId
    }
  }

  let resolvedPollOptions: { id: string; label: string }[] = []
  let pollVoteCounts: Record<string, number> = {}
  if (mediaKind === 'poll') {
    if (!Array.isArray(pollOptions) || pollOptions.length < 2 || pollOptions.length > 4) {
      throw new HttpsError('invalid-argument', 'A poll needs 2-4 options.')
    }
    resolvedPollOptions = pollOptions.map((label: unknown, index: number) => ({
      id: `opt${index}`,
      label: String(label).slice(0, 80),
    }))
    pollVoteCounts = Object.fromEntries(resolvedPollOptions.map((o) => [o.id, 0]))
  }

  const hours = Math.min(Math.max(Number(expiresInHours) || STORY_DEFAULT_DURATION_HOURS, 1), STORY_MAX_DURATION_HOURS)
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)
  const clampedDurationSec = Math.min(Math.max(Number(durationSec) || 5, 1), STORY_MAX_DURATION_SEC)

  const storyRef = db.collection('stories').doc()
  await storyRef.set({
    storyId: storyRef.id,
    artistId,
    mediaKind,
    storyCategory,
    mediaUrl: mediaUrl ?? null,
    mediaStoragePath: typeof mediaStoragePath === 'string' ? mediaStoragePath : null,
    caption: typeof caption === 'string' ? caption.slice(0, 500) : '',
    visibility,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    durationSec: clampedDurationSec,
    ctaType: resolvedCtaType,
    ctaTargetId: resolvedCtaTargetId,
    isHighlight: false,
    highlightGroup: null,
    uniqueViewerCount: 0,
    reactionCount: 0,
    ctaClickCount: 0,
    pollOptions: resolvedPollOptions,
    pollVoteCounts,
  })

  return { storyId: storyRef.id }
})

export const toggleStoryHighlight = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const { storyId, isHighlight, highlightGroup } = request.data ?? {}
  if (!storyId || typeof isHighlight !== 'boolean') {
    throw new HttpsError('invalid-argument', 'storyId and isHighlight are required.')
  }

  const storyRef = db.collection('stories').doc(storyId)
  const storySnap = await storyRef.get()
  if (!storySnap.exists) throw new HttpsError('not-found', 'Story not found.')
  if (storySnap.data()?.artistId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Not your Story.')
  }

  await storyRef.update({
    isHighlight,
    highlightGroup: isHighlight && typeof highlightGroup === 'string' ? highlightGroup.slice(0, 60) : null,
  })

  return { ok: true }
})
