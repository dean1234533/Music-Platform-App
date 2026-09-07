import { Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { djNavItems } from '@/components/layout/navConfig'

export function DJDashboardLayout() {
  return (
    <AppShell sidebarItems={djNavItems} mobileNavItems={djNavItems} sidebarTitle="DJ">
      <Outlet />
    </AppShell>
  )
}
