import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { createHash } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

/**
 * Hashes every newly-uploaded master (SHA-256, Node's built-in crypto — no
 * new deps) and flags a possible duplicate if another artist's track shares
 * the same hash. A hash proves nothing about ownership — this only ever
 * flags for admin review, never auto-removes.
 */
export const onOriginalUploaded = onObjectFinalized(
  async (event) => {
    const filePath = event.data.name
    const match = filePath.match(/^artists\/([^/]+)\/originals\/([^/.]+)\.[^/]+$/)
    if (!match) return
    const [, ownerArtistId, trackId] = match

    const trackRef = db.collection('tracks').doc(trackId!)
    const trackSnap = await trackRef.get()
    if (!trackSnap.exists) return

    const bucket = event.data.bucket
    const { getStorage } = await import('firebase-admin/storage')
    const [contents] = await getStorage().bucket(bucket).file(filePath).download()
    const hash = createHash('sha256').update(contents).digest('hex')

    const duplicateQuery = await db
      .collection('tracks')
      .where('fileHash', '==', hash)
      .where('artistId', '!=', ownerArtistId)
      .limit(1)
      .get()
    const possibleDuplicateOfTrackId = duplicateQuery.empty ? null : duplicateQuery.docs[0]!.id

    await trackRef.update({
      fileHash: hash,
      fileSize: contents.byteLength,
      mimeType: event.data.contentType ?? null,
      hashCheckedAt: FieldValue.serverTimestamp(),
      possibleDuplicateOfTrackId,
    })

    if (possibleDuplicateOfTrackId) {
      await db.collection('notifications').add({
        userId: ownerArtistId,
        type: 'possible_duplicate_upload',
        title: 'Possible duplicate upload flagged',
        body: 'This upload matches an existing file from another artist. Our team may review it.',
        linkTo: '/dashboard/artist/music',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
  },
)
