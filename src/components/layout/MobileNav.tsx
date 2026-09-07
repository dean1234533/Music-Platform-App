import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { clsx } from 'clsx'
import { signOut } from '@/services/authService'
import type { NavItem } from './navConfig'

/**
 * Scrolls horizontally instead of squeezing every item into an equal-width
 * flex-1 column — a role with more than ~5 nav items (artist, DJ, admin)
 * would otherwise render unreadably narrow tabs with no way to reach the
 * rest. Sign out is pinned outside the scrollable row (not part of `items`
 * for any role) so it's always one tap away regardless of how many tabs a
 * role has, rather than depending on every role remembering to route
 * through a Settings page that has one.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/[0.07] bg-surface-1/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex flex-1 overflow-x-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'relative flex min-w-[4.25rem] shrink-0 flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                isActive ? 'text-brand-400 after:absolute after:top-0 after:h-px after:w-6 after:bg-brand-500' : 'text-ink-3',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
      <button
        onClick={handleSignOut}
        aria-label="Sign out"
        className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 border-l border-white/[0.07] py-2.5 text-xs font-medium text-ink-3 transition-colors hover:text-danger-500"
      >
        <LogOut className="h-5 w-5" />
        Sign out
      </button>
    </nav>
  )
}
