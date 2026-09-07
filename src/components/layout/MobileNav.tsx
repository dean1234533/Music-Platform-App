import { useRef, useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import type { NavItem } from './navConfig'

/**
 * Scrolls horizontally instead of squeezing every item into an equal-width
 * flex-1 column — a role with more than ~5 nav items (artist, DJ, admin)
 * would otherwise render unreadably narrow tabs with no way to reach the
 * rest. Sign out lives on each role's own Settings/Profile page, not here —
 * it doesn't need a permanent slot in the bottom bar.
 *
 * Edge fades hint that the row scrolls — without them, tabs past the first
 * screenful (e.g. Revenue/Settings on the artist dashboard) look like they
 * don't exist rather than like they're one swipe away.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)

  const updateFades = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowLeftFade(el.scrollLeft > 4)
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateFades()
    window.addEventListener('resize', updateFades)
    return () => window.removeEventListener('resize', updateFades)
  }, [updateFades, items])

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-surface-1/95 shadow-[0_-14px_40px_rgba(0,0,0,.3)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={updateFades}
          className="flex snap-x snap-mandatory gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
        {showLeftFade ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface-1 to-transparent" />
        ) : null}
        {showRightFade ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface-1 to-transparent" />
        ) : null}
      </div>
    </nav>
  )
}
