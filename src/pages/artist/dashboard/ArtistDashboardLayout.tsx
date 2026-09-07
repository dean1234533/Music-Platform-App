import { Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { artistDashboardNavItems } from '@/components/layout/navConfig'

const mobileItems = artistDashboardNavItems.slice(0, 5)

export function ArtistDashboardLayout() {
  return (
    <AppShell sidebarItems={artistDashboardNavItems} mobileNavItems={mobileItems} sidebarTitle="Artist Dashboard">
      <Outlet />
    </AppShell>
  )
}
