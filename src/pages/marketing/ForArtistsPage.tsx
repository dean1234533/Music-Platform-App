import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'
import { useSeo } from '@/lib/seo'
import { ARTIST_FAQS as FAQS } from '@/content/faqs'

export function ForArtistsPage() {
  useSeo({
    title: 'Get Paid Directly by Fans and DJs — No Label Needed',
    description: 'Publish your music, keep 80–85% of what fans and DJs pay you directly, and set your own terms for DJ licensing. 14-day free trial, then £29.99/year, no revenue percentage.',
    path: '/for-artists',
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
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <Link to="/"><BrandMark /></Link>
        <Link to="/" className="flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0"><ArrowLeft className="h-4 w-4" /> Back home</Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <p className="eyebrow">For artists</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-6xl">Get paid directly by the fans and DJs who actually want your music.</h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-ink-2">
          No label, no percentage of every stream. Try it free for 14 days, then a flat £29.99 a year — keep 80% of
          direct fan support and 85% of DJ licensing revenue, on terms you set.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link to="/sign-up?role=artist" className="group inline-flex items-center gap-3 rounded-full bg-brand-500 px-6 py-3.5 text-sm font-semibold text-surface-0 transition hover:bg-brand-400">
            Start your free trial <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/blog/how-independent-artists-get-paid" className="text-sm font-medium text-ink-1 transition hover:text-white">See how the numbers work →</Link>
        </div>

        <div className="mt-16 grid gap-3 sm:grid-cols-3">
          {[
            ['14-day free trial', "Try publishing and everything else free for 14 days before you're charged."],
            ['80–85% revenue share', 'Keep 80% of fan support and 85% of DJ licensing revenue, after tax and processing fees.'],
            ['You set DJ terms', 'Permitted use, territory, duration, and price for every track you open to DJ licensing — entirely optional.'],
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
