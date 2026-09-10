import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'
import { ErrorState } from '@/components/common/StateViews'
import { getBlogPost, BLOG_POSTS } from '@/content/blog'
import { useSeo, SITE_NAME } from '@/lib/seo'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getBlogPost(slug) : undefined

  useSeo({
    title: post?.title ?? 'Blog',
    description: post?.description ?? '',
    path: `/blog/${slug ?? ''}`,
    type: 'article',
    jsonLd: post
      ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          author: { '@type': 'Organization', name: post.author },
          publisher: { '@type': 'Organization', name: SITE_NAME },
          url: `${typeof window !== 'undefined' ? window.location.origin : ''}/blog/${post.slug}`,
        }
      : undefined,
  })

  if (!post) {
    return (
      <div className="min-h-svh bg-surface-0 text-ink-0">
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-surface-0/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8"><Link to="/"><BrandMark /></Link></div>
        </header>
        <main className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:px-8"><ErrorState title="Post not found" description="This blog post doesn't exist." /></main>
      </div>
    )
  }

  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2)

  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
          <Link to="/"><BrandMark /></Link>
          <Link to="/blog" className="flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0"><ArrowLeft className="h-4 w-4" /> All posts</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
        <article>
          <div className="flex items-center gap-3 text-xs text-ink-3">
            <span>{formatDate(post.date)}</span>
            <span aria-hidden="true">·</span>
            <span>{post.author}</span>
          </div>
          <h1 className="mt-4 text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-5xl">{post.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-ink-1">{tag}</span>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-5 text-base leading-8 text-ink-1">
            {post.body.map((paragraph, index) =>
              paragraph.startsWith('## ') ? (
                <h2 key={index} className="mt-3 text-2xl font-medium tracking-[-0.02em] text-ink-0">{paragraph.slice(3)}</h2>
              ) : (
                <p key={index}>{paragraph}</p>
              ),
            )}
          </div>
        </article>

        {related.length > 0 ? (
          <div className="mt-16 border-t border-white/[0.08] pt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-3">More from the blog</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map((p) => (
                <Link key={p.slug} to={`/blog/${p.slug}`} className="group rounded-xl border border-white/[0.08] p-5 transition hover:border-white/20">
                  <h3 className="text-base font-medium text-ink-0 transition group-hover:text-brand-400">{p.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-2">{p.description}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
