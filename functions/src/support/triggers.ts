import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

const RECENT_PREVIEW_WINDOW_MS = 24 * 60 * 60 * 1000

export const onSupportRelationshipCreate = onDocumentCreated('supportRelationships/{relationshipId}', async (event) => {
  const data = event.data?.data() as { artistId?: string; fanId?: string } | undefined
  const artistId = data?.artistId
  const fanId = data?.fanId
  if (!artistId) return

  const update: Record<string, unknown> = { supporterCount: FieldValue.increment(1) }

  // Same real-conversion signal as onFollowCreate — only counted when this
  // fan genuinely previewed this artist within the last 24h.
  if (fanId) {
    const previewSession = await db.collection('previewSessions').doc(`${fanId}_${artistId}`).get()
    const lastPreviewAt = previewSession.data()?.lastPreviewAt as FirebaseFirestore.Timestamp | undefined
    if (lastPreviewAt && Date.now() - lastPreviewAt.toMillis() <= RECENT_PREVIEW_WINDOW_MS) {
      update.supportConversions = FieldValue.increment(1)
    }
  }

  await db.collection('artistProfiles').doc(artistId).update(update)
})

export const onSupportRelationshipDelete = onDocumentDeleted('supportRelationships/{relationshipId}', async (event) => {
  const artistId = event.data?.data().artistId as string | undefined
  if (!artistId) return
  await db.collection('artistProfiles').doc(artistId).update({ supporterCount: FieldValue.increment(-1) })
})
