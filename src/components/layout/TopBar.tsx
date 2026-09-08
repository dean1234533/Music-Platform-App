import { Link, useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { BrandMark } from '@/components/common/BrandMark'
import { DashboardSwitcherCompact } from './DashboardSwitcher'

export function TopBar() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
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

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.07] bg-surface-0/80 px-4 py-3 backdrop-blur-xl md:hidden">
      <div className="flex items-center gap-3">
        <Link to={homeTo} className="flex items-center gap-2">
          <BrandMark />
        </Link>
        <DashboardSwitcherCompact />
      </div>
      <div className="flex items-center gap-3">
        <Link to="/app/notifications" className="rounded-full p-2 text-ink-2 hover:bg-surface-2">
          <Bell className="h-5 w-5" />
        </Link>
        <Link to={profileTo} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-surface-3">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-ink-1">
              {(profile?.displayName ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
