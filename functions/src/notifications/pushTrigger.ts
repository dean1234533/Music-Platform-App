import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'
import { FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { db } from '../admin.js'

/**
 * Single dispatch point for push notifications: every existing call site
 * already writes a `notifications/{id}` doc (for the in-app bell), so this
 * trigger is the only place that needs to know about FCM — no need to touch
 * submitLicenceRequest, sendMessage, signAgreement, the Stripe webhooks, etc.
 */
export const onNotificationCreatePush = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const notification = event.data?.data()
  if (!notification) return

  const userSnap = await db.collection('users').doc(notification.userId).get()
  const tokens = (userSnap.data()?.fcmTokens ?? []) as string[]
  if (tokens.length === 0) return

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.linkTo ? { linkTo: notification.linkTo } : {},
    webpush: notification.linkTo ? { fcmOptions: { link: notification.linkTo } } : undefined,
  })

  const invalidTokens = response.responses
    .map((result, i) => (!result.success ? tokens[i] : null))
    .filter((token): token is string => token !== null)

  if (invalidTokens.length > 0) {
    logger.info('Removing invalid FCM tokens', { userId: notification.userId, count: invalidTokens.length })
    await db.collection('users').doc(notification.userId).update({
      fcmTokens: FieldValue.arrayRemove(...invalidTokens),
    })
  }
})
