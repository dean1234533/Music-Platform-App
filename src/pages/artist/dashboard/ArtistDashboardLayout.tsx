import { Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { artistDashboardNavItems } from '@/components/layout/navConfig'

export function ArtistDashboardLayout() {
  return (
    <AppShell sidebarItems={artistDashboardNavItems} mobileNavItems={artistDashboardNavItems} sidebarTitle="Artist Dashboard">
      <Outlet />
    </AppShell>
  )
}
