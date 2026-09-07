import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

/**
 * trackCount is denormalised onto artistProfiles so the tracks/{trackId}
 * create rule can compare it against trackLimit without resolving a plan.
 * Exact mirror of the followerCount pattern in follows.ts.
 */
export const onTrackCreate = onDocumentCreated('tracks/{trackId}', async (event) => {
  const artistId = event.data?.data().artistId as string | undefined
  if (!artistId) return
  await db.collection('artistProfiles').doc(artistId).update({ trackCount: FieldValue.increment(1) })
})

export const onTrackDelete = onDocumentDeleted('tracks/{trackId}', async (event) => {
  const artistId = event.data?.data().artistId as string | undefined
  if (!artistId) return
  await db.collection('artistProfiles').doc(artistId).update({ trackCount: FieldValue.increment(-1) })
})
