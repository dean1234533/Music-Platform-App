import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import type { NavItem } from './navConfig'

/**
 * Scrolls horizontally instead of squeezing every item into an equal-width
 * flex-1 column — a role with more than ~5 nav items (artist, DJ, admin)
 * would otherwise render unreadably narrow tabs with no way to reach the
 * rest. Sign out lives on each role's own Settings/Profile page, not here —
 * it doesn't need a permanent slot in the bottom bar.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-surface-1/95 shadow-[0_-14px_40px_rgba(0,0,0,.3)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'relative flex w-20 min-w-20 snap-start flex-none flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[0.6875rem] font-semibold leading-none transition-colors',
                isActive ? 'bg-brand-400/[0.09] text-brand-400' : 'text-ink-3 active:bg-white/[0.05]',
              )
            }
          >
            <item.icon className="h-[1.15rem] w-[1.15rem] shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
