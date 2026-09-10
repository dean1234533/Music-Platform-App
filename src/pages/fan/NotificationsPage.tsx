import { useEffect, useState } from 'react'
import { Bell, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { deleteNotification, markNotificationRead, subscribeNotifications } from '@/services/notificationService'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { NotificationDoc } from '@/types/notification'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { PushNotificationControl } from '@/components/notifications/PushNotificationControl'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
] as const

export function NotificationsPage() {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const { notify } = useToast()
  const [notifications, setNotifications] = useState<NotificationDoc[] | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  async function handleDelete(notificationId: string) {
    setDeletingId(notificationId)
    try {
      await deleteNotification(notificationId)
    } catch {
      notify('Could not delete that notification. Please try again.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0
  const filtered = filter === 'unread' ? (notifications ?? []).filter((n) => !n.read) : (notifications ?? [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink-0">Notifications</h1>
        {notifications && notifications.length > 0 ? (
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={clsx(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition',
                  filter === f.key ? 'bg-brand-500/15 text-brand-400' : 'text-ink-3 hover:text-ink-1',
                )}
              >
                {f.label}
                {f.key === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <PushNotificationControl />
      {notifications === null ? (
        <LoadingState />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8 text-ink-3" />}
          title="No notifications yet"
          description="You'll hear about new releases, supporter perks, and account activity here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Bell className="h-8 w-8 text-ink-3" />} title="No unread notifications" />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border overflow-hidden rounded-2xl border border-surface-border">
          {filtered.map((n) => (
            <div
              key={n.notificationId}
              className={clsx('flex items-start gap-2 px-4 py-3', !n.read && 'bg-surface-1')}
            >
              <button onClick={() => void openNotification(n)} className="flex min-w-0 flex-1 flex-col gap-1 text-left hover:opacity-80">
                <div className="flex items-center gap-2">
                  {!n.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" /> : null}
                  <span className="text-sm font-medium text-ink-0">{n.title}</span>
                </div>
                <p className="text-xs text-ink-2">{n.body}</p>
              </button>
              <button
                onClick={() => void handleDelete(n.notificationId)}
                disabled={deletingId === n.notificationId}
                aria-label="Delete notification"
                className="shrink-0 rounded-full p-1.5 text-ink-3 transition hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
