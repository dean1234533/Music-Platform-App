import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { TopBar } from './TopBar'
import { PlayerBar } from '@/components/player/PlayerBar'
import type { NavItem } from './navConfig'

export function AppShell({
  children,
  sidebarItems,
  mobileNavItems,
  mobileMoreExclude,
  sidebarTitle,
}: {
  children: ReactNode
  sidebarItems: NavItem[]
  mobileNavItems: NavItem[]
  mobileMoreExclude?: string[]
  sidebarTitle?: string
}) {
  return (
    <div className="flex h-svh w-full max-w-full flex-col overflow-x-hidden bg-transparent">
      <div className="flex min-h-0 min-w-0 flex-1">
        <Sidebar items={sidebarItems} title={sidebarTitle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="w-full min-w-0 flex-1 overflow-y-auto px-4 pb-32 pt-4 md:px-8 md:pb-28 md:pt-8 xl:px-12">
            <div className="mx-auto min-w-0 max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
      <PlayerBar />
      <MobileNav items={mobileNavItems} moreExclude={mobileMoreExclude} />
    </div>
  )
}
