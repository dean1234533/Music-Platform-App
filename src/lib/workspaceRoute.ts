import type { UserRole } from '@/types/user'

export function workspaceHomeForRoles(roles: UserRole[]): string {
  if (roles.includes('admin')) return '/admin/users'
  if (roles.includes('artist')) return '/dashboard/artist'
  if (roles.includes('dj')) return '/dj/discover'
  if (roles.includes('fan')) return '/app/home'
  return '/onboarding'
}
