import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'

/**
 * followerCount is denormalised onto artistProfiles for cheap public reads.
 * It is only ever mutated here, server-side, so a client can never inflate
 * its own follower count by writing to artistProfiles directly (rules also
 * block that field from client updates as a second layer of defence).
 */
export const onFollowCreate = onDocumentCreated('follows/{followId}', async (event) => {
  const artistId = event.data?.data().artistId as string | undefined
  if (!artistId) return
  await db.collection('artistProfiles').doc(artistId).update({
    followerCount: FieldValue.increment(1),
  })
})

export const onFollowDelete = onDocumentDeleted('follows/{followId}', async (event) => {
  const artistId = event.data?.data().artistId as string | undefined
  if (!artistId) return
  await db.collection('artistProfiles').doc(artistId).update({
    followerCount: FieldValue.increment(-1),
  })
})
