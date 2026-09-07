import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import type { NavItem } from './navConfig'

export function MobileNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/[0.07] bg-surface-1/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            clsx(
              'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
              isActive ? 'text-brand-400 after:absolute after:top-0 after:h-px after:w-6 after:bg-brand-500' : 'text-ink-3',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
