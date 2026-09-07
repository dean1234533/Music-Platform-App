import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

export const onSupportRelationshipCreate = onDocumentCreated('supportRelationships/{relationshipId}', async (event) => {
  const artistId = event.data?.data().artistId as string | undefined
  if (!artistId) return
  await db.collection('artistProfiles').doc(artistId).update({ supporterCount: FieldValue.increment(1) })
})

export const onSupportRelationshipDelete = onDocumentDeleted('supportRelationships/{relationshipId}', async (event) => {
  const artistId = event.data?.data().artistId as string | undefined
  if (!artistId) return
  await db.collection('artistProfiles').doc(artistId).update({ supporterCount: FieldValue.increment(-1) })
})
