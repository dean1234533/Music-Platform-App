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
  sidebarTitle,
}: {
  children: ReactNode
  sidebarItems: NavItem[]
  mobileNavItems: NavItem[]
  sidebarTitle?: string
}) {
  return (
    <div className="flex h-svh flex-col bg-transparent">
      <div className="flex min-h-0 flex-1">
        <Sidebar items={sidebarItems} title={sidebarTitle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto px-4 pb-32 pt-4 md:px-8 md:pb-28 md:pt-8 xl:px-12">
            <div className="mx-auto max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
      <PlayerBar />
      <MobileNav items={mobileNavItems} />
    </div>
  )
}
