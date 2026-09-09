/**
 * Intercepts crawler requests to /artist/:slug and /artist/:slug/track/:trackId
 * (and the legacy flat /track/:trackId) to inject real Open Graph / Twitter
 * Card meta tags, since a bare SPA gives link-unfurling bots nothing useful.
 * Every other request — including these same paths for a real browser —
 * falls straight through to the static SPA via the ASSETS binding. Any
 * failure anywhere in the crawler branch also falls through, so a bug here
 * can never break the real site.
 */

import { BLOG_POSTS } from '../src/content/blog.ts'
import { DJ_FAQS, ARTIST_FAQS } from '../src/content/faqs.ts'

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

// GEO: AI answer-engine / LLM crawlers. These generally don't execute JS and
// benefit from real body text (for citation), not just OG meta — handled
// separately below via renderContentHtml rather than the redirect-stub
// renderMetaHtml used for social-card unfurling bots.
const AI_CRAWLER_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
  'Bytespider',
  'cohere-ai',
  'Amazonbot',
  'meta-externalagent',
]

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false
  return CRAWLER_USER_AGENTS.some((needle) => userAgent.includes(needle)) || isAiCrawler(userAgent)
}

function isAiCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false
  return AI_CRAWLER_USER_AGENTS.some((needle) => userAgent.includes(needle))
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
<meta property="og:site_name" content="BackTheVibes" />
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

/**
 * Full static HTML with real body text — for content pages (home, pricing,
 * /for-djs, /for-artists, blog) rather than the redirect-stub renderMetaHtml
 * used for social-unfurl cards. A non-JS-executing crawler (most AI/GEO
 * bots) needs actual readable content here, not just meta tags plus a
 * meta-refresh to a URL it likely won't re-fetch.
 */
function renderContentHtml(opts: { title: string; description: string; url: string; bodyHtml: string; jsonLd?: object }): string {
  const { title, description, url, bodyHtml, jsonLd } = opts
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="BackTheVibes" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDescription}" />
<meta property="og:url" content="${escapeHtml(url)}" />
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
<main>
<h1>${safeTitle}</h1>
${bodyHtml}
</main>
</body>
</html>`
}

function renderParagraphs(paragraphs: string[]): string {
  return paragraphs
    .map((p) => (p.startsWith('## ') ? `<h2>${escapeHtml(p.slice(3))}</h2>` : `<p>${escapeHtml(p)}</p>`))
    .join('\n')
}

function renderFaqs(faqs: [string, string][]): string {
  return faqs.map(([q, a]) => `<h2>${escapeHtml(q)}</h2>\n<p>${escapeHtml(a)}</p>`).join('\n')
}

function contentResponse(html: string): Response {
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

// --- Route handling -----------------------------------------------------------

async function buildArtistCard(projectId: string, slug: string, url: string): Promise<Response | null> {
  const slugDoc = await fetchFirestoreDoc(projectId, `artistSlugs/${slug}`)
  const artistId = slugDoc?.artistId as string | undefined
  if (!artistId) return null
  const artist = await fetchFirestoreDoc(projectId, `artistProfiles/${artistId}`)
  if (!artist) return null

  const html = renderMetaHtml({
    title: `${artist.name as string} on BackTheVibes`,
    description: (artist.bio as string) || `Listen to ${artist.name as string} on BackTheVibes — independent music, direct support.`,
    image: (artist.coverURL as string | null) ?? (artist.photoURL as string | null) ?? null,
    url,
  })
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

async function buildTrackCard(projectId: string, slug: string, trackParam: string, url: string): Promise<Response | null> {
  const slugDoc = await fetchFirestoreDoc(projectId, `artistSlugs/${slug}`)
  const artistId = slugDoc?.artistId as string | undefined
  if (!artistId) return null

  // trackParam is either a clean trackSlug (new share links) or a raw
  // trackId (older links already shared) — the trackSlugs registry is
  // keyed by artistId+slug, so a hit there wins; otherwise fall back to
  // treating the param as a literal trackId.
  const slugRegistryDoc = await fetchFirestoreDoc(projectId, `trackSlugs/${artistId}_${trackParam}`)
  const trackId = (slugRegistryDoc?.trackId as string | undefined) ?? trackParam

  // Track docs are visibility-gated by Firestore rules — the REST API
  // enforces the same rules unauthenticated, so a non-public track 403s.
  // Fall back to the artist-level card rather than fabricating track data.
  const track = await fetchFirestoreDoc(projectId, `tracks/${trackId}`)
  if (!track) return buildArtistCard(projectId, slug, url)

  const artist = await fetchFirestoreDoc(projectId, `artistProfiles/${artistId}`)
  const artistName = (artist?.name as string | undefined) ?? 'an independent artist'

  const html = renderMetaHtml({
    title: `${track.title as string} — ${artistName}`,
    description: `Listen to "${track.title as string}" by ${artistName} on BackTheVibes.`,
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
      const url = requestUrl.toString()

      // Home
      if (parts.length === 0) {
        return contentResponse(
          renderContentHtml({
            title: 'BackTheVibes — Music with a pulse',
            description:
              'Support the artists you actually listen to. Discover independent music, support artists directly, and give DJs a better way to find what comes next.',
            url,
            bodyHtml:
              '<p>BackTheVibes connects independent musicians, listeners, and DJs directly. Fans discover and support artists with direct monthly memberships. DJs license tracks directly from the artist who made them, with a real e-signed agreement. Artists publish music and keep control of their own licensing terms.</p><ul><li><a href="/for-artists">For artists</a></li><li><a href="/for-djs">For DJs</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/blog">Blog</a></li></ul>',
            jsonLd: {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'BackTheVibes',
              url: requestUrl.origin,
            },
          }),
        )
      }

      // /pricing
      if (parts[0] === 'pricing' && parts.length === 1) {
        return contentResponse(
          renderContentHtml({
            title: 'Pricing — BackTheVibes',
            description:
              'Listeners and DJs join free. Artists publish for £29.99/year (14 days free) — no revenue percentage. Fans keep 80% of support going straight to artists; DJs pay only for the licences they agree to.',
            url,
            bodyHtml:
              '<p>Listening, following artists, and building a library is free. An optional Supporter membership from £4.99/month lets a fan direct monthly support to artists they follow — artists receive 80% of net supporter revenue directed to them.</p><p>Joining as a DJ is free. DJs pay only for the licences they agree to, on terms the artist sets per track.</p><p>Artists publish for a flat £29.99/year — 14 days free, not a percentage of earnings — and keep 85% of net DJ licensing revenue.</p>',
          }),
        )
      }

      // /for-djs
      if (parts[0] === 'for-djs' && parts.length === 1) {
        return contentResponse(
          renderContentHtml({
            title: 'License Music for DJ Sets — Direct From the Artist — BackTheVibes',
            description:
              'Discover independent tracks and get a real, e-signed licence directly from the artist — for live sets, recorded mixtapes, or streaming. Free to join.',
            url,
            bodyHtml: `<p>Discover independent tracks, agree terms directly with the artist, and get a real e-signed licence — not a blanket "DJ pool" download with terms nobody read. Free to join.</p>${renderFaqs(DJ_FAQS)}`,
            jsonLd: {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: DJ_FAQS.map(([question, answer]) => ({
                '@type': 'Question',
                name: question,
                acceptedAnswer: { '@type': 'Answer', text: answer },
              })),
            },
          }),
        )
      }

      // /for-artists
      if (parts[0] === 'for-artists' && parts.length === 1) {
        return contentResponse(
          renderContentHtml({
            title: 'Get Paid Directly by Fans and DJs — No Label Needed — BackTheVibes',
            description:
              'Publish your music, keep 80–85% of what fans and DJs pay you directly, and set your own terms for DJ licensing. 14-day free trial, then £29.99/year, no revenue percentage.',
            url,
            bodyHtml: `<p>No label, no percentage of every stream. Try it free for 14 days, then a flat £29.99 a year — keep 80% of direct fan support and 85% of DJ licensing revenue, on terms you set.</p>${renderFaqs(ARTIST_FAQS)}`,
            jsonLd: {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: ARTIST_FAQS.map(([question, answer]) => ({
                '@type': 'Question',
                name: question,
                acceptedAnswer: { '@type': 'Answer', text: answer },
              })),
            },
          }),
        )
      }

      // /blog
      if (parts[0] === 'blog' && parts.length === 1) {
        const list = BLOG_POSTS.slice()
          .reverse()
          .map((post) => `<li><a href="/blog/${post.slug}">${escapeHtml(post.title)}</a> — ${escapeHtml(post.description)}</li>`)
          .join('\n')
        return contentResponse(
          renderContentHtml({
            title: 'Blog — BackTheVibes',
            description: 'Guides on DJ licensing, independent artist earnings, and music discovery — from the team behind BackTheVibes.',
            url,
            bodyHtml: `<ul>${list}</ul>`,
          }),
        )
      }

      // /blog/:slug
      if (parts[0] === 'blog' && parts.length === 2) {
        const post = BLOG_POSTS.find((p) => p.slug === parts[1])
        if (post) {
          return contentResponse(
            renderContentHtml({
              title: `${post.title} — BackTheVibes`,
              description: post.description,
              url,
              bodyHtml: renderParagraphs(post.body),
              jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                headline: post.title,
                description: post.description,
                datePublished: post.date,
                author: { '@type': 'Organization', name: post.author },
                publisher: { '@type': 'Organization', name: 'BackTheVibes' },
                url,
              },
            }),
          )
        }
      }

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
            title: `${track.title as string} — ${(artist?.name as string) ?? 'BackTheVibes'}`,
            description: `Listen to "${track.title as string}" on BackTheVibes.`,
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
