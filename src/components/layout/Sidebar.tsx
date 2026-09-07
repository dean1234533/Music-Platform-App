import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { Music2 } from 'lucide-react'
import type { NavItem } from './navConfig'

export function Sidebar({ items, title }: { items: NavItem[]; title?: string }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-surface-border bg-surface-1 px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <Music2 className="h-6 w-6 text-brand-400" />
        <span className="text-lg font-semibold tracking-tight text-ink-0">Wavelength</span>
      </div>
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
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-500/15 text-brand-400'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink-0',
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
