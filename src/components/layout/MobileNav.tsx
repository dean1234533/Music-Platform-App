import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { clsx } from 'clsx'
import { MoreSheet } from './MoreSheet'
import type { NavItem } from './navConfig'

const PRIMARY_COUNT = 4

/**
 * Fixed 4 primary tabs + a "More" tab that opens a sheet with the rest —
 * no horizontal scrolling, so nothing is ever off-screen without a visible
 * cue. `items` should be ordered most-used-first (see navConfig.ts).
 * `moreExclude` drops items already reachable elsewhere on mobile (e.g.
 * Notifications/Profile, which TopBar already surfaces) so they don't
 * appear twice.
 */
export function MobileNav({ items, moreExclude = [] }: { items: NavItem[]; moreExclude?: string[] }) {
  const location = useLocation()
  const [showMore, setShowMore] = useState(false)
  const primary = items.slice(0, PRIMARY_COUNT)
  const more = items.slice(PRIMARY_COUNT).filter((item) => !moreExclude.includes(item.to))
  const isMoreActive = more.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/[0.07] bg-surface-1/95 pb-[max(0.375rem,calc(env(safe-area-inset-bottom)-1rem))] shadow-[0_-14px_40px_rgba(0,0,0,.3)] backdrop-blur-xl md:hidden"
      >
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[0.6875rem] font-semibold leading-none transition-colors',
                isActive ? 'text-brand-400' : 'text-ink-3 active:bg-white/[0.05]',
              )
            }
          >
            <item.icon className="h-[1.15rem] w-[1.15rem] shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
          </NavLink>
        ))}
        {more.length > 0 ? (
          <button
            onClick={() => setShowMore(true)}
            className={clsx(
              'flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[0.6875rem] font-semibold leading-none transition-colors',
              isMoreActive ? 'text-brand-400' : 'text-ink-3 active:bg-white/[0.05]',
            )}
          >
            <MoreHorizontal className="h-[1.15rem] w-[1.15rem] shrink-0" />
            More
          </button>
        ) : null}
      </nav>
      {showMore ? <MoreSheet items={more} onClose={() => setShowMore(false)} /> : null}
    </>
  )
}
