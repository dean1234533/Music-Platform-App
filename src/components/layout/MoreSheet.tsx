import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import type { NavItem } from './navConfig'

export function MoreSheet({ items, onClose }: { items: NavItem[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 md:hidden" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl border-t border-white/[0.08] bg-surface-1 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-0">More</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pb-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex flex-col items-center gap-2 rounded-xl px-2 py-4 text-xs font-medium ${
                  isActive ? 'bg-brand-400/[0.09] text-brand-400' : 'text-ink-2 active:bg-white/[0.05]'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-center leading-tight">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
