import { collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { doc, setDoc, deleteDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore'
import { db, storage } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import { compressImage } from './imageProcessing'
import { MAX_VIDEO_MB, MAX_AUDIO_MB } from '@/constants/mediaConfig'
import type {
  StoryCategory,
  StoryCtaType,
  StoryDoc,
  StoryMediaKind,
  StoryVisibility,
} from '@/types/story'

const STORAGE_TIER: Record<StoryVisibility, string> = {
  public: 'public',
  followers: 'followers',
  supporters: 'supporters',
  dj: 'dj',
}

/**
 * Images are compressed client-side exactly like other image uploads.
 * Video/audio Stories are size-validated and uploaded as-is — there is no
 * video re-encode pipeline in this codebase yet, so we don't pretend to
 * compress what we don't actually process.
 */
export async function uploadStoryMedia(
  artistId: string,
  visibility: StoryVisibility,
  mediaKind: 'image' | 'video' | 'audio',
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ url: string; path: string }> {
  let uploadFile = file
  if (mediaKind === 'image') {
    const { file: compressed } = await compressImage(file, 'story')
    uploadFile = compressed
  } else if (mediaKind === 'video' && file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`Video must be under ${MAX_VIDEO_MB}MB.`)
  } else if (mediaKind === 'audio' && file.size > MAX_AUDIO_MB * 1024 * 1024) {
    throw new Error(`Audio must be under ${MAX_AUDIO_MB}MB.`)
  }

  const ext = uploadFile.name.split('.').pop() ?? 'bin'
  const path = `artists/${artistId}/stories/${STORAGE_TIER[visibility]}/${crypto.randomUUID()}.${ext}`
  const task = uploadBytesResumable(ref(storage, path), uploadFile)
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.(snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0),
      reject,
      () => resolve(),
    )
  })
  const url = await getDownloadURL(task.snapshot.ref)
  return { url, path }
}

export interface CreateStoryInput {
  mediaKind: StoryMediaKind
  storyCategory: StoryCategory
  mediaUrl?: string
  mediaStoragePath?: string
  caption?: string
  visibility: StoryVisibility
  durationSec?: number
  ctaType?: StoryCtaType
  ctaTargetId?: string
  pollOptions?: string[]
}

export const createStory = callable<CreateStoryInput, { storyId: string }>('createStory')

/**
 * public-tier stories use story.mediaUrl directly (storage.rules makes that
 * path genuinely public, no round-trip needed). Every other tier's media is
 * owner-only at Storage — call this for a short-lived signed URL instead,
 * checked server-side against the viewer's current follow/support/DJ
 * entitlement each time rather than trusting a URL that could outlive it.
 */
export const getStoryMediaUrl = callable<{ storyId: string }, { url: string }>('getStoryMediaUrl')

export async function deleteStory(storyId: string): Promise<void> {
  await deleteDoc(doc(db, 'stories', storyId))
}

export const toggleStoryHighlight = callable<
  { storyId: string; isHighlight: boolean; highlightGroup?: string },
  { ok: boolean }
>('toggleStoryHighlight')

/** Owner-only: every one of this artist's Stories, including expired ones, newest first. */
export function subscribeArtistStories(
  artistId: string,
  onChange: (stories: StoryDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, 'stories'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as StoryDoc)),
    (error) => {
      console.error('[subscribeArtistStories] listener error:', error)
      onError?.(error)
    },
  )
}

/** Public Highlights row on an artist's profile — public-tier highlights only. */
export function subscribeArtistPublicHighlights(
  artistId: string,
  onChange: (stories: StoryDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(db, 'stories'),
    where('artistId', '==', artistId),
    where('visibility', '==', 'public'),
    where('isHighlight', '==', true),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as StoryDoc)),
    (error) => {
      console.error('[subscribeArtistPublicHighlights] listener error:', error)
      onError?.(error)
    },
  )
}

/**
 * Active (non-expired) Stories for one artist at one visibility tier. Callers
 * that qualify for multiple tiers (e.g. a follower who's also a supporter)
 * fire one call per tier and merge client-side — the same tiered-parallel-
 * query technique used for tracks/artistPosts, required because Firestore
 * rejects a single query that could match a doc the viewer isn't allowed to
 * read.
 */
export function subscribeActiveStoriesForArtist(
  artistId: string,
  tier: StoryVisibility,
  onChange: (stories: StoryDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(db, 'stories'),
    where('artistId', '==', artistId),
    where('visibility', '==', tier),
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'asc'),
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as StoryDoc)),
    (error) => {
      console.error('[subscribeActiveStoriesForArtist] listener error:', error)
      onError?.(error)
    },
  )
}

/** Firestore's `in` operator caps at 10 values — chunk a followed/supported-artist list into batches. */
export function chunk<T>(items: T[], size = 10): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function subscribeActiveStoriesForArtists(
  artistIds: string[],
  tier: StoryVisibility,
  onChange: (stories: StoryDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (artistIds.length === 0) {
    onChange([])
    return () => {}
  }
  const batches = chunk(artistIds, 10)
  const perBatch = new Map<number, StoryDoc[]>()
  const unsubs = batches.map((batch, i) => {
    const q = query(
      collection(db, 'stories'),
      where('artistId', 'in', batch),
      where('visibility', '==', tier),
      where('expiresAt', '>', Timestamp.now()),
      orderBy('expiresAt', 'asc'),
    )
    return onSnapshot(
      q,
      (snap) => {
        perBatch.set(i, snap.docs.map((d) => d.data() as StoryDoc))
        onChange(Array.from(perBatch.values()).flat())
      },
      (error) => {
        console.error('[subscribeActiveStoriesForArtists] listener error:', error)
        onError?.(error)
      },
    )
  })
  return () => unsubs.forEach((u) => u())
}

/** Drives the seen/unseen ring on StoryBubble/StoryRail. */
export function subscribeMyViewedStoryIds(
  userId: string,
  onChange: (storyIds: Set<string>) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, 'storyViews'), where('userId', '==', userId))
  return onSnapshot(
    q,
    (snap) => onChange(new Set(snap.docs.map((d) => (d.data() as { storyId: string }).storyId))),
    (error) => {
      console.error('[subscribeMyViewedStoryIds] listener error:', error)
      onError?.(error)
    },
  )
}

export async function recordStoryView(storyId: string, userId: string): Promise<void> {
  await setDoc(doc(db, 'storyViews', `${storyId}_${userId}`), { storyId, userId, viewedAt: serverTimestamp() })
}

export async function reactToStory(storyId: string, userId: string, emoji: string): Promise<void> {
  await setDoc(doc(db, 'storyReactions', `${storyId}_${userId}`), { storyId, userId, emoji, createdAt: serverTimestamp() })
}

export async function unreactToStory(storyId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, 'storyReactions', `${storyId}_${userId}`))
}

export async function voteStoryPoll(storyId: string, userId: string, optionId: string): Promise<void> {
  await setDoc(doc(db, 'storyPollVotes', `${storyId}_${userId}`), { storyId, userId, optionId, votedAt: serverTimestamp() })
}

/** The only client-writable field on a story doc — rules enforce it can only ever go up by exactly 1. */
export async function recordStoryCtaClick(storyId: string): Promise<void> {
  await updateDoc(doc(db, 'stories', storyId), { ctaClickCount: increment(1) })
}
