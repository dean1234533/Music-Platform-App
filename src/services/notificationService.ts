import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NotificationDoc } from '@/types/notification'

export function subscribeNotifications(
  userId: string,
  onChange: (items: NotificationDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() as NotificationDoc), notificationId: d.id }))),
    (error) => {
      console.error('[subscribeNotifications] listener error:', error)
      onError?.(error)
    },
  )
}

/** Lightweight — feeds the notification bell badge without the full page's list subscription. */
export function subscribeUnreadNotificationCount(
  userId: string,
  onChange: (count: number) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false))
  return onSnapshot(
    q,
    (snap) => onChange(snap.size),
    (error) => {
      console.error('[subscribeUnreadNotificationCount] listener error:', error)
      onError?.(error)
    },
  )
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true })
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId))
}
