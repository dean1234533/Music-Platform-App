import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'
import { BLOG_POSTS } from '@/content/blog'
import { useSeo, SITE_NAME } from '@/lib/seo'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function BlogIndexPage() {
  useSeo({
    title: 'Blog',
    description: 'Guides on DJ licensing, independent artist earnings, and music discovery — from the team behind BackTheVibes.',
    path: '/blog',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${SITE_NAME} Blog`,
      url: `${typeof window !== 'undefined' ? window.location.origin : ''}/blog`,
      blogPost: BLOG_POSTS.map((post) => ({
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/blog/${post.slug}`,
      })),
    },
  })

  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <Link to="/"><BrandMark /></Link>
        <Link to="/" className="flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0"><ArrowLeft className="h-4 w-4" /> Back home</Link>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <p className="eyebrow">Blog</p>
        <h1 className="mt-4 text-5xl font-medium tracking-[-0.055em] sm:text-7xl">Notes on independent music.</h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-ink-2">Guides on DJ licensing, artist earnings, and how discovery actually works — written for the people using BackTheVibes.</p>

        <div className="mt-16 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {BLOG_POSTS.slice().reverse().map((post) => (
            <Link key={post.slug} to={`/blog/${post.slug}`} className="group grid gap-3 py-8 transition sm:grid-cols-[8rem_1fr]">
              <span className="text-xs text-ink-3">{formatDate(post.date)}</span>
              <div>
                <h2 className="text-xl font-medium tracking-[-0.02em] text-ink-0 transition group-hover:text-brand-400">{post.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">{post.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-400">
                  Read <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
