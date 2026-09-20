import { Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { artistNavItemsFor } from '@/components/layout/navConfig'
import { useAuth } from '@/contexts/AuthContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'

export function ArtistDashboardLayout() {
  const { firebaseUser } = useAuth()
  const artist = useArtistSummary(firebaseUser?.uid ?? null)
  const navItems = artistNavItemsFor(artist?.creatorType)

  return (
    <AppShell
      sidebarItems={navItems}
      mobileNavItems={navItems}
      sidebarTitle={artist?.creatorType === 'dancer' ? 'Dancer Dashboard' : 'Artist Dashboard'}
    >
      <Outlet />
    </AppShell>
  )
}
