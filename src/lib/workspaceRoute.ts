import type { UserProfile, UserRole } from '@/types/user'

export function workspaceHomeForRoles(roles: UserRole[]): string {
  if (roles.includes('admin')) return '/admin/users'
  if (roles.includes('artist')) return '/dashboard/artist'
  if (roles.includes('dj')) return '/dj/discover'
  if (roles.includes('fan')) return '/app/home'
  return '/onboarding'
}

/**
 * Where "Back" should land when there's no real history to go back to (see
 * useSmartBack). For a signed-in, onboarded user this should be their own
 * workspace, not the public marketing homepage — landing a logged-in PWA
 * user on the marketing site reads exactly like "back sent me to the wrong
 * home page".
 */
export function homeFallbackPath(profile: UserProfile | null): string {
  if (!profile?.onboardingComplete) return '/'
  return workspaceHomeForRoles(profile.roles)
}
