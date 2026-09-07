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

  const itemClasses =
    'relative flex w-16 shrink-0 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors'

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-surface-1/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex justify-around overflow-x-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                itemClasses,
                isActive ? 'text-brand-400 after:absolute after:top-0 after:h-px after:w-6 after:bg-brand-500' : 'text-ink-3',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        <button onClick={handleSignOut} aria-label="Sign out" className={clsx(itemClasses, 'text-ink-3 hover:text-danger-500')}>
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </nav>
  )
}
