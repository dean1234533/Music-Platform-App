import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount'
import { BrandMark } from '@/components/common/BrandMark'
import { DashboardSwitcherSidebar } from './DashboardSwitcher'
import type { NavItem } from './navConfig'

export function Sidebar({ items, title }: { items: NavItem[]; title?: string }) {
  const unreadCount = useUnreadNotificationCount()
  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-r border-white/[0.06] bg-surface-1/75 px-4 py-6 backdrop-blur-xl md:flex">
      <div className="mb-9 px-2"><BrandMark /></div>
      <DashboardSwitcherSidebar />
      {title ? (
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{title}</p>
      ) : null}
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-white/[0.07] text-ink-0 shadow-[inset_3px_0_0_var(--color-brand-500)]'
                  : 'text-ink-2 hover:bg-white/[0.035] hover:text-ink-0',
              )
            }
          >
            <item.icon className="h-[17px] w-[17px] transition-colors group-hover:text-brand-400" />
            {item.label}
            {item.to.endsWith('/notifications') && unreadCount > 0 ? (
              <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold leading-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
