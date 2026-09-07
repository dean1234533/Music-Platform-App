/**
 * Intercepts crawler requests to /artist/:slug and /artist/:slug/track/:trackId
 * (and the legacy flat /track/:trackId) to inject real Open Graph / Twitter
 * Card meta tags, since a bare SPA gives link-unfurling bots nothing useful.
 * Every other request — including these same paths for a real browser —
 * falls straight through to the static SPA via the ASSETS binding. Any
 * failure anywhere in the crawler branch also falls through, so a bug here
 * can never break the real site.
 */

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  FIREBASE_PROJECT_ID: string
}

const CRAWLER_USER_AGENTS = [
  'Twitterbot',
  'facebookexternalhit',
  'Discordbot',
  'WhatsApp',
  'Slackbot',
  'LinkedInBot',
  'TelegramBot',
  'Googlebot',
  'Applebot',
  'SkypeUriPreview',
  'Pinterest',
]

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false
  return CRAWLER_USER_AGENTS.some((needle) => userAgent.includes(needle))
}

// --- Firestore REST wire-format decoding -----------------------------------

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } }

function unwrapFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('booleanValue' in value) return value.booleanValue
  if ('nullValue' in value) return null
  if ('mapValue' in value) return unwrapFirestoreDoc(value.mapValue.fields ?? {})
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(unwrapFirestoreValue)
  return null
}

function unwrapFirestoreDoc(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) out[key] = unwrapFirestoreValue(value)
  return out
}

async function fetchFirestoreDoc(
  projectId: string,
  path: string,
): Promise<Record<string, unknown> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json()) as { fields?: Record<string, FirestoreValue> }
  return unwrapFirestoreDoc(json.fields ?? {})
}

// --- HTML templating ---------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderMetaHtml(opts: { title: string; description: string; image: string | null; url: string }): string {
  const { title, description, image, url } = opts
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)
  const safeImage = image ? escapeHtml(image) : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta property="og:type" content="profile" />
<meta property="og:site_name" content="Wavelength" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDescription}" />
<meta property="og:url" content="${escapeHtml(url)}" />
${safeImage ? `<meta property="og:image" content="${safeImage}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDescription}" />
${safeImage ? `<meta name="twitter:image" content="${safeImage}" />` : ''}
<meta http-equiv="refresh" content="0;url=${escapeHtml(url)}" />
</head>
<body>
<a href="${escapeHtml(url)}">${safeTitle}</a>
</body>
</html>`
}

// --- Route handling -----------------------------------------------------------

async function buildArtistCard(projectId: string, slug: string, url: string): Promise<Response | null> {
  const slugDoc = await fetchFirestoreDoc(projectId, `artistSlugs/${slug}`)
  const artistId = slugDoc?.artistId as string | undefined
  if (!artistId) return null
  const artist = await fetchFirestoreDoc(projectId, `artistProfiles/${artistId}`)
  if (!artist) return null

  const html = renderMetaHtml({
    title: `${artist.name as string} on Wavelength`,
    description: (artist.bio as string) || `Listen to ${artist.name as string} on Wavelength — independent music, direct support.`,
    image: (artist.coverURL as string | null) ?? (artist.photoURL as string | null) ?? null,
    url,
  })
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

async function buildTrackCard(projectId: string, slug: string, trackId: string, url: string): Promise<Response | null> {
  const slugDoc = await fetchFirestoreDoc(projectId, `artistSlugs/${slug}`)
  const artistId = slugDoc?.artistId as string | undefined
  if (!artistId) return null

  // Track docs are visibility-gated by Firestore rules — the REST API
  // enforces the same rules unauthenticated, so a non-public track 403s.
  // Fall back to the artist-level card rather than fabricating track data.
  const track = await fetchFirestoreDoc(projectId, `tracks/${trackId}`)
  if (!track) return buildArtistCard(projectId, slug, url)

  const artist = await fetchFirestoreDoc(projectId, `artistProfiles/${artistId}`)
  const artistName = (artist?.name as string | undefined) ?? 'an independent artist'

  const html = renderMetaHtml({
    title: `${track.title as string} — ${artistName}`,
    description: `Listen to "${track.title as string}" by ${artistName} on Wavelength.`,
    image: (track.artworkURL as string | null) ?? (artist?.photoURL as string | null) ?? null,
    url,
  })
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const userAgent = request.headers.get('user-agent')
    if (!isCrawler(userAgent)) return env.ASSETS.fetch(request)

    try {
      const requestUrl = new URL(request.url)
      const parts = requestUrl.pathname.split('/').filter(Boolean)
      const projectId = env.FIREBASE_PROJECT_ID

      // /artist/:slug/track/:trackId
      if (parts[0] === 'artist' && parts.length === 4 && parts[2] === 'track') {
        const [, slug, , trackId] = parts
        const card = await buildTrackCard(projectId, slug!, trackId!, requestUrl.toString())
        if (card) return card
      }

      // /artist/:slug
      if (parts[0] === 'artist' && parts.length === 2) {
        const [, slug] = parts
        const card = await buildArtistCard(projectId, slug!, requestUrl.toString())
        if (card) return card
      }

      // Legacy flat /track/:trackId — resolve the artist via the track doc.
      if (parts[0] === 'track' && parts.length === 2) {
        const [, trackId] = parts
        const track = await fetchFirestoreDoc(projectId, `tracks/${trackId}`)
        const artistId = track?.artistId as string | undefined
        if (track && artistId) {
          const artist = await fetchFirestoreDoc(projectId, `artistProfiles/${artistId}`)
          const html = renderMetaHtml({
            title: `${track.title as string} — ${(artist?.name as string) ?? 'Wavelength'}`,
            description: `Listen to "${track.title as string}" on Wavelength.`,
            image: (track.artworkURL as string | null) ?? null,
            url: requestUrl.toString(),
          })
          return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
        }
      }
    } catch {
      // Any failure in the crawler branch falls through to the normal SPA.
    }

    return env.ASSETS.fetch(request)
  },
}
