import { Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { adminNavItems } from '@/components/layout/navConfig'

export function AdminDashboardLayout() {
  return (
    <AppShell sidebarItems={adminNavItems} mobileNavItems={adminNavItems} sidebarTitle="Admin">
      <Outlet />
    </AppShell>
  )
}
