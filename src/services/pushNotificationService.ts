import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore'
import { getToken, isSupported } from 'firebase/messaging'
import { db, FIREBASE_VAPID_KEY, getMessagingInstance } from '@/lib/firebase'

export type PushPermissionResult = 'granted' | 'denied' | 'unsupported'

/**
 * Requests notification permission, registers the FCM token for this
 * device, and stores it on the user's own doc (rules already allow a user
 * to write their own non-frozen fields, so no rule change was needed).
 * Safe to call repeatedly — re-requesting after "granted" just refreshes
 * the token.
 */
export async function enablePushNotifications(uid: string): Promise<PushPermissionResult> {
  if (!(await isSupported())) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const messaging = await getMessagingInstance()
  if (!messaging) return 'unsupported'

  const registration = await navigator.serviceWorker.ready
  const token = await getToken(messaging, {
    vapidKey: FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  if (!token) throw new Error('This device did not create a notification token. Please close and reopen the installed app, then try again.')
  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) })

  return 'granted'
}

export async function disablePushNotifications(uid: string): Promise<void> {
  if (!(await isSupported())) return
  const messaging = await getMessagingInstance()
  if (!messaging) return

  const registration = await navigator.serviceWorker.ready
  const token = await getToken(messaging, {
    vapidKey: FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  }).catch(() => null)

  if (token) {
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) })
  }
}

export function currentPushPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}
