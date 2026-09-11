import { Link, useLocation } from 'react-router-dom'
import { Bell, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount'
import { BrandMark } from '@/components/common/BrandMark'
import { DashboardSwitcherCompact } from './DashboardSwitcher'

export function TopBar() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  const unreadCount = useUnreadNotificationCount()
  const homeTo = pathname.startsWith('/dashboard/artist')
    ? '/dashboard/artist'
    : pathname.startsWith('/dj')
      ? '/dj/discover'
      : pathname.startsWith('/admin')
        ? '/admin/users'
        : '/app/home'
  const profileTo = pathname.startsWith('/dashboard/artist')
    ? '/dashboard/artist/settings'
    : pathname.startsWith('/dj')
      ? '/dj/profile'
      : pathname.startsWith('/admin')
        ? '/admin/settings'
        : '/app/profile'
  const notificationsTo = pathname.startsWith('/dashboard/artist')
    ? '/dashboard/artist/notifications'
    : pathname.startsWith('/dj')
      ? '/dj/notifications'
      : pathname.startsWith('/admin')
        ? '/admin/notifications'
        : '/app/notifications'

  return (
    <header className="sticky top-0 z-30 flex w-full min-w-0 items-center justify-between border-b border-white/[0.07] bg-surface-0/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <Link to={homeTo} className="flex min-w-0 items-center">
          <BrandMark />
        </Link>
        <DashboardSwitcherCompact />
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-1">
        <Link to={notificationsTo} className="relative rounded-full p-2 text-ink-2 hover:bg-surface-2" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Link>
        {isAdmin ? (
          // No photo/avatar concept for an admin account — there's no public-facing "admin
          // profile" for a photo to represent, and AdminSettingsPage has no photo upload UI at
          // all, so the shared avatar circle used here for fan/artist/dj was a dead end
          // (user-reported: "on the admin page it has a hole for a profile image but why would
          // i even need this... it does nothing").
          <Link to={profileTo} className="flex h-8 w-8 items-center justify-center rounded-full p-2 text-ink-2 hover:bg-surface-2" aria-label="Admin settings">
            <Settings className="h-5 w-5" />
          </Link>
        ) : (
          <Link to={profileTo} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-surface-3">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-ink-1">
                {(profile?.displayName ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  )
}
