import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'
import { useSeo } from '@/lib/seo'
import { DJ_FAQS as FAQS } from '@/content/faqs'

export function ForDjsPage() {
  useSeo({
    title: 'License Music for DJ Sets — Direct From the Artist',
    description: 'Discover independent tracks and get a real, e-signed licence directly from the artist — for live sets, recorded mixtapes, or streaming. Free to join.',
    path: '/for-djs',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    },
  })

  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
        <Link to="/"><BrandMark /></Link>
        <Link to="/" className="flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0"><ArrowLeft className="h-4 w-4" /> Back home</Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <p className="eyebrow">For DJs</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-6xl">License music for your sets, directly from the artist.</h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-ink-2">
          Discover independent tracks, agree terms directly with the artist, and get a real e-signed licence — not a
          blanket "DJ pool" download with terms nobody read. Free to join.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link to="/sign-up?role=dj" className="group inline-flex items-center gap-3 rounded-full bg-brand-500 px-6 py-3.5 text-sm font-semibold text-surface-0 transition hover:bg-brand-400">
            Create a free DJ profile <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/blog/how-djs-license-tracks-legally" className="text-sm font-medium text-ink-1 transition hover:text-white">Read the licensing guide →</Link>
        </div>

        <div className="mt-16 grid gap-3 sm:grid-cols-3">
          {[
            ['Direct terms', 'Permitted use, territory, duration and price — set by the artist, not a third-party aggregator.'],
            ['E-signed agreements', 'Every licence is a dated, signed record you can point to if a promoter or platform asks.'],
            ['Full-quality unlock', 'The signed agreement is what unlocks the full-quality download, not a promo-tier file.'],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-2xl border border-white/[0.08] p-6">
              <Check className="h-5 w-5 text-brand-400" />
              <h3 className="mt-4 text-lg font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-2">{copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <h2 className="text-2xl font-medium tracking-[-0.03em]">Frequently asked</h2>
          <div className="mt-6 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {FAQS.map(([question, answer]) => (
              <div key={question} className="py-6">
                <h3 className="text-base font-medium text-ink-0">{question}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-2">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
