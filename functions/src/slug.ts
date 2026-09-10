/** Mirrors src/utils/slug.ts on the client — kept in sync by hand since functions/ and src/ are separate TS projects. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Mirrors src/utils/slug.ts's RESERVED_ARTIST_SLUGS — see that file for why these are treated as a soft collision, not a hard block. */
export const RESERVED_ARTIST_SLUGS = new Set([
  'admin', 'administrator', 'login', 'signin', 'sign-in', 'signup', 'sign-up', 'logout', 'settings', 'api', 'app',
  'dashboard', 'support', 'help', 'contact', 'about', 'terms', 'privacy', 'legal', 'billing', 'account', 'onboarding',
  'verify-email', 'forgot-password', 'reset-password', 'artist', 'artists', 'dj', 'djs', 'track', 'tracks', 'pricing',
  'blog', 'faq', 'search', 'discover', 'official', 'staff', 'moderator', 'moderation', 'backthevibes', 'spotify',
  'soundcloud', 'apple-music', 'youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'null', 'undefined', 'new',
  'edit', 'delete',
])
