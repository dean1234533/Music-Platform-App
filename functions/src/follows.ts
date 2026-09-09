import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'

const RECENT_PREVIEW_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * followerCount is denormalised onto artistProfiles for cheap public reads.
 * It is only ever mutated here, server-side, so a client can never inflate
 * its own follower count by writing to artistProfiles directly (rules also
 * block that field from client updates as a second layer of defence).
 */
export const onFollowCreate = onDocumentCreated('follows/{followId}', async (event) => {
  const data = event.data?.data() as { artistId?: string; fanId?: string } | undefined
  const artistId = data?.artistId
  const fanId = data?.fanId
  if (!artistId) return

  const update: Record<string, unknown> = { followerCount: FieldValue.increment(1) }

  // Real conversion tracking: only counted when this fan genuinely played a
  // preview of this artist within the last 24h — never assumed, and never
  // inflated by a follow that had nothing to do with a preview.
  if (fanId) {
    const previewSession = await db.collection('previewSessions').doc(`${fanId}_${artistId}`).get()
    const lastPreviewAt = previewSession.data()?.lastPreviewAt as FirebaseFirestore.Timestamp | undefined
    if (lastPreviewAt && Date.now() - lastPreviewAt.toMillis() <= RECENT_PREVIEW_WINDOW_MS) {
      update.followConversions = FieldValue.increment(1)
    }
  }

  await db.collection('artistProfiles').doc(artistId).update(update)
})

export const onFollowDelete = onDocumentDeleted('follows/{followId}', async (event) => {
  const artistId = event.data?.data().artistId as string | undefined
  if (!artistId) return
  await db.collection('artistProfiles').doc(artistId).update({
    followerCount: FieldValue.increment(-1),
  })
})
