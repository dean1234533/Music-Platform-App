import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { markNotificationRead, subscribeNotifications } from '@/services/notificationService'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { NotificationDoc } from '@/types/notification'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { PushNotificationControl } from '@/components/notifications/PushNotificationControl'

export function NotificationsPage() {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const { notify } = useToast()
  const [notifications, setNotifications] = useState<NotificationDoc[] | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeNotifications(firebaseUser.uid, setNotifications)
  }, [firebaseUser])

  async function openNotification(notification: NotificationDoc) {
    try {
      if (!notification.read) await markNotificationRead(notification.notificationId)
      if (notification.linkTo) navigate(notification.linkTo)
    } catch {
      notify('Could not open that notification. Please try again.', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Notifications</h1>
      <PushNotificationControl />
      {notifications === null ? (
        <LoadingState />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8 text-ink-3" />}
          title="No notifications yet"
          description="You'll hear about new releases, supporter perks, and account activity here."
        />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border overflow-hidden rounded-2xl border border-surface-border">
          {notifications.map((n) => (
            <button
              key={n.notificationId}
              onClick={() => void openNotification(n)}
              className={clsx('flex flex-col gap-1 px-4 py-3 text-left hover:bg-surface-2', !n.read && 'bg-surface-1')}
            >
              <div className="flex items-center gap-2">
                {!n.read ? <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> : null}
                <span className="text-sm font-medium text-ink-0">{n.title}</span>
              </div>
              <p className="text-xs text-ink-2">{n.body}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
