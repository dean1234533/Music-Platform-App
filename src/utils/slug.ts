export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Artist slugs live under /artist/{slug} — a separate path segment from the
 * app's own top-level routes, so there's no literal routing collision with
 * e.g. /admin. The risk here is impersonation/confusion instead: a link like
 * /artist/support or /artist/backthevibes reads as if it might be an
 * official or platform-run account. Treated as a soft collision (falls
 * through to the same numbered-suffix logic as a taken name) rather than a
 * hard block, so a legitimate artist named e.g. "Support" can still sign up
 * as /artist/support-2 instead of being turned away outright. True
 * trademark/impersonation disputes beyond this list are an admin
 * moderation matter, not something to solve automatically here.
 */
export const RESERVED_ARTIST_SLUGS = new Set([
  'admin',
  'administrator',
  'login',
  'signin',
  'sign-in',
  'signup',
  'sign-up',
  'logout',
  'settings',
  'api',
  'app',
  'dashboard',
  'support',
  'help',
  'contact',
  'about',
  'terms',
  'privacy',
  'legal',
  'billing',
  'account',
  'onboarding',
  'verify-email',
  'forgot-password',
  'reset-password',
  'artist',
  'artists',
  'dj',
  'djs',
  'track',
  'tracks',
  'pricing',
  'blog',
  'faq',
  'search',
  'discover',
  'official',
  'staff',
  'moderator',
  'moderation',
  'backthevibes',
  'spotify',
  'soundcloud',
  'apple-music',
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'twitter',
  'null',
  'undefined',
  'new',
  'edit',
  'delete',
])
