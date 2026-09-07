import { Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { fanMobileMoreExclude, fanNavItems } from '@/components/layout/navConfig'

export function FanDashboardLayout() {
  return (
    <AppShell sidebarItems={fanNavItems} mobileNavItems={fanNavItems} mobileMoreExclude={fanMobileMoreExclude}>
      <Outlet />
    </AppShell>
  )
}
