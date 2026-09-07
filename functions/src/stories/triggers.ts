import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

/** Denormalised counters on the story doc — mirrors follows/followerCount's trigger-aggregate pattern. */
export const onStoryViewCreate = onDocumentCreated('storyViews/{viewId}', async (event) => {
  const storyId = event.data?.data().storyId as string | undefined
  if (!storyId) return
  await db.collection('stories').doc(storyId).update({ uniqueViewerCount: FieldValue.increment(1) })
})

export const onStoryReactionCreate = onDocumentCreated('storyReactions/{reactionId}', async (event) => {
  const storyId = event.data?.data().storyId as string | undefined
  if (!storyId) return
  await db.collection('stories').doc(storyId).update({ reactionCount: FieldValue.increment(1) })
})

export const onStoryReactionDelete = onDocumentDeleted('storyReactions/{reactionId}', async (event) => {
  const storyId = event.data?.data().storyId as string | undefined
  if (!storyId) return
  await db.collection('stories').doc(storyId).update({ reactionCount: FieldValue.increment(-1) })
})

export const onStoryPollVoteCreate = onDocumentCreated('storyPollVotes/{voteId}', async (event) => {
  const data = event.data?.data() as { storyId?: string; optionId?: string } | undefined
  if (!data?.storyId || !data.optionId) return
  await db
    .collection('stories')
    .doc(data.storyId)
    .update({ [`pollVoteCounts.${data.optionId}`]: FieldValue.increment(1) })
})
