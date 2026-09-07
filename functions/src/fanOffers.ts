import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'

type Audience = 'everyone' | 'followers' | 'supporters'

async function connectedFanIds(artistId: string, audience: Audience): Promise<Set<string>> {
  const fanIds = new Set<string>()
  if (audience === 'everyone' || audience === 'followers') {
    const follows = await db.collection('follows').where('artistId', '==', artistId).get()
    follows.docs.forEach((item) => fanIds.add(item.data().fanId as string))
  }
  if (audience === 'everyone' || audience === 'supporters') {
    const supporters = await db.collection('supportRelationships').where('artistId', '==', artistId).get()
    supporters.docs.forEach((item) => fanIds.add(item.data().fanId as string))
  }
  return fanIds
}

export const onFanOfferCreate = onDocumentCreated('fanOffers/{offerId}', async (event) => {
  const offer = event.data?.data() as { artistId?: string; title?: string; audience?: Audience } | undefined
  if (!offer?.artistId || !offer.title || !offer.audience) return

  const [artistSnapshot, fanIds] = await Promise.all([
    db.collection('artistProfiles').doc(offer.artistId).get(),
    connectedFanIds(offer.artistId, offer.audience),
  ])
  const artistName = (artistSnapshot.data()?.name as string | undefined) ?? 'An artist you follow'
  const writer = db.bulkWriter()
  for (const fanId of fanIds) {
    const notificationRef = db.collection('notifications').doc()
    writer.set(notificationRef, {
      notificationId: notificationRef.id,
      userId: fanId,
      type: 'fan_offer',
      title: `New offer from ${artistName}`,
      body: offer.title,
      linkTo: '/app/offers',
      offerId: event.params.offerId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
  }
  await writer.close()
})

export const onFanOfferDelete = onDocumentDeleted('fanOffers/{offerId}', async (event) => {
  const offerId = event.params.offerId
  const [claims, notifications] = await Promise.all([
    db.collection('fanOfferClaims').where('offerId', '==', offerId).get(),
    db.collection('notifications').where('offerId', '==', offerId).get(),
  ])
  const writer = db.bulkWriter()
  claims.docs.forEach((item) => writer.delete(item.ref))
  notifications.docs.forEach((item) => writer.delete(item.ref))
  await writer.close()
})
