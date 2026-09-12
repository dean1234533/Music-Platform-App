import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { db } from '../admin.js'
import { requireActiveUser, userHasRole } from '../roles.js'
import { enforceRateLimit } from '../rateLimit.js'

// Mirrors src/constants/mediaConfig.ts's STORY_* constants — rules/Functions
// can't import client TS, so these are hand-kept-in-sync (same convention
// already used for storage.rules' size/type literals).
// Fixed at exactly 24 hours, like Instagram — not artist-configurable. The only way to keep a
// story around longer is to mark it a Highlight (isHighlight), which is exempt from expiry
// entirely rather than just getting a longer timer.
const STORY_DURATION_HOURS = 24
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

/** "Supporter" means: has ever made a one-off support payment to this artist — see functions/src/tracks.ts's isActiveSupporter for the same definition. */
async function isActiveSupporter(uid: string, artistId: string): Promise<boolean> {
  const relationship = await db.collection('supportRelationships').doc(`${uid}_${artistId}`).get()
  return relationship.exists
}

/**
 * CTA targets are restricted to enumerated, server-validated destinations —
 * never an arbitrary URL from the client — so a Story can never be used as
 * an open redirect. 'track' is the only type that needs its target checked
 * against a real record the artist actually owns.
 */
export const createStory = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
  const artistId = request.auth.uid
  if (!(await userHasRole(artistId, 'artist'))) {
    throw new HttpsError('permission-denied', 'Only artists can post Stories.')
  }
  await enforceRateLimit(`createStory_${artistId}`, 30, 60 * 60)

  const {
    mediaKind,
    storyCategory,
    mediaUrl,
    mediaStoragePath,
    caption,
    visibility,
    durationSec,
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

  const expiresAt = new Date(Date.now() + STORY_DURATION_HOURS * 60 * 60 * 1000)
  const clampedDurationSec = Math.min(Math.max(Number(durationSec) || 5, 1), STORY_MAX_DURATION_SEC)

  const storyRef = db.collection('stories').doc()
  await storyRef.set({
    storyId: storyRef.id,
    artistId,
    mediaKind,
    storyCategory,
    // A getDownloadURL() token is permanent and bypasses Storage rules
    // entirely once issued (see getStoryMediaUrl's doc comment below) — only
    // ever persist it for public stories, where that's already the intended
    // access level. Restricted tiers keep only mediaStoragePath, so the only
    // way to ever obtain a working URL is the audience-checked
    // getStoryMediaUrl callable, re-verified on every call rather than once.
    mediaUrl: visibility === 'public' && typeof mediaUrl === 'string' ? mediaUrl : null,
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

async function canViewStory(uid: string | null, story: FirebaseFirestore.DocumentData): Promise<boolean> {
  if (uid === story.artistId) return true
  if (story.visibility === 'public') return true
  if (!uid) return false

  const userSnap = await db.collection('users').doc(uid).get()
  const roles = (userSnap.data()?.roles ?? []) as string[]
  if (roles.includes('admin')) return true

  if (story.visibility === 'followers') {
    const follow = await db.collection('follows').doc(`${uid}_${story.artistId}`).get()
    return follow.exists || isActiveSupporter(uid, story.artistId)
  }
  if (story.visibility === 'supporters') {
    return isActiveSupporter(uid, story.artistId)
  }
  if (story.visibility === 'dj') {
    if (!roles.includes('dj')) return false
    const artistSnap = await db.collection('artistProfiles').doc(story.artistId).get()
    return artistSnap.data()?.storiesDjEnabled === true
  }
  return false
}

/**
 * getDownloadURL() tokens are permanent and bypass Storage rules entirely
 * once issued, so storing one directly on a followers/supporters/dj-tier
 * story doc would let anyone who ever saw that URL keep using it after
 * unfollowing, losing supporter status, or the artist changing their mind —
 * the same problem getTrackPlaybackUrl solves for track audio. Public-tier
 * stories skip this and use mediaUrl directly (storage.rules already makes
 * artists/{artistId}/stories/public/ genuinely public, no signed URL needed).
 */
export const getStoryMediaUrl = onCall(async (request) => {
  const { storyId } = request.data ?? {}
  if (!storyId || typeof storyId !== 'string') throw new HttpsError('invalid-argument', 'storyId is required.')

  const snap = await db.collection('stories').doc(storyId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'Story not found.')
  const story = snap.data()!

  if (!(await canViewStory(request.auth?.uid ?? null, story))) {
    throw new HttpsError('permission-denied', 'You do not have access to this Story.')
  }

  const path = story.mediaStoragePath as string | null
  if (!path) throw new HttpsError('failed-precondition', 'This Story has no media.')
  const expectedPrefix = `artists/${story.artistId}/stories/`
  if (!path.startsWith(expectedPrefix)) throw new HttpsError('failed-precondition', 'Invalid media path.')

  const [url] = await getStorage().bucket().file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + 10 * 60 * 1000,
  })
  return { url }
})

export const toggleStoryHighlight = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  await requireActiveUser(request.auth.uid)
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
