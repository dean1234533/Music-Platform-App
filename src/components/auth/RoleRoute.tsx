import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingState } from '@/components/common/StateViews'
import { workspaceHomeForRoles } from '@/lib/workspaceRoute'
import type { UserRole } from '@/types/user'

export function RoleRoute({ role, children }: { role: UserRole; children: ReactNode }) {
  const { profile, initializing } = useAuth()

  if (initializing) return <LoadingState />

  if (!profile?.roles.includes(role)) {
    return <Navigate to={workspaceHomeForRoles(profile?.roles ?? [])} replace />
  }

  return <>{children}</>
}
