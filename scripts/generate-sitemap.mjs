// Regenerates public/sitemap.xml from the static routes plus current blog
// slugs, so a new blog post automatically appears in the next build's
// sitemap without a manual edit here. Run as part of `npm run build`.
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { BLOG_POSTS } from '../src/content/blog.ts'

const SITE_URL = 'https://music-platform-app.dbsworkouts.workers.dev'

const STATIC_ROUTES = [
  { path: '/', priority: '1.0' },
  { path: '/pricing', priority: '0.8' },
  { path: '/for-djs', priority: '0.8' },
  { path: '/for-artists', priority: '0.8' },
  { path: '/blog', priority: '0.7' },
  { path: '/terms', priority: '0.3' },
  { path: '/privacy', priority: '0.3' },
  { path: '/copyright', priority: '0.3' },
  { path: '/sign-in', priority: '0.2' },
  { path: '/sign-up', priority: '0.4' },
]

const blogRoutes = BLOG_POSTS.map((post) => ({ path: `/blog/${post.slug}`, priority: '0.6', lastmod: post.date }))

const urls = [...STATIC_ROUTES, ...blogRoutes]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${SITE_URL}${u.path}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml')
await writeFile(outPath, xml)
console.log(`sitemap.xml written with ${urls.length} URLs`)
