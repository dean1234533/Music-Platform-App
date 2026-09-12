import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'

const sections: [string, string][] = [
  [
    'Rights declaration when adding a track',
    'BackTheVibes does not host audio — a track is a link to the artist\'s own official YouTube upload, played through the official YouTube player. Every artist must still confirm they have the rights and permissions needed to promote that linked content through BackTheVibes before it can be published, and must disclose samples, cover/interpolation status, featured artists, producers, songwriters, and any label or publisher involvement. This declaration is recorded, but it is evidence of a claim to rights — not proof of ownership, not a guarantee against a later dispute, and not a substitute for YouTube\'s own copyright process on the underlying video.',
  ],
  [
    'Filing a claim',
    'If you are a rights holder (or an authorised representative) and believe a track infringes your copyright, use the "Report copyright issue" link on the track page or file a claim directly. We require your name, contact email, a description of the infringement, and a declaration signature.',
  ],
  [
    'Review process',
    'Claims are reviewed by our team, not resolved automatically. A claim may move through several stages: under review, information required, artist notified, temporarily restricted, removed, rejected, or resolved. The uploading artist is notified of claims against their tracks and can respond or, where a track has been restricted or removed, submit a counter-notice.',
  ],
  [
    'Temporary restriction',
    'Rather than only an all-or-nothing removal, a track under review may have specific capabilities restricted — such as DJ licensing, discovery placement, or full-length streaming — while the claim is investigated.',
  ],
  [
    'Removal and payment holds',
    'If a claim is upheld, the track\'s link is taken down and new fan support or collaboration/licence payments to the artist are placed on hold pending resolution — this never affects money the artist has already been paid directly by Stripe. Holds are cleared automatically if a track is later restored.',
  ],
  [
    'Counter-notices',
    'An artist whose track has been restricted or removed can submit a statement disputing the claim. This is a starting point for dispute review inside BackTheVibes, not a substitute for a formal legal counter-notice process in your jurisdiction.',
  ],
  [
    'Repeat infringement',
    'Accounts with a pattern of upheld copyright claims against them are subject to further account-level action, including suspension.',
  ],
  [
    'DJ/business collaboration',
    'A collaboration or licensing agreement, where one exists, only grants the specific permitted uses agreed between the artist and the DJ/business — it does not transfer any copyright ownership. BackTheVibes does not host, store, or transfer master recordings or stems; any exchange of those files happens directly between the parties outside the platform.',
  ],
]

export function CopyrightPolicyPage() {
  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
          <Link to="/">
            <BrandMark />
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-4 text-5xl font-medium tracking-[-0.055em] sm:text-7xl">Copyright policy</h1>
        <p className="mt-6 text-sm text-ink-3">Last updated 7 September 2026</p>
        <div className="mt-10">
          <Link
            to="/copyright/report"
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-[#080a05] hover:bg-brand-400"
          >
            Report copyright infringement
          </Link>
        </div>
        <div className="mt-16 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {sections.map(([title, copy], index) => (
            <section key={title} className="grid gap-4 py-8 sm:grid-cols-[3rem_1fr_2fr]">
              <span className="text-xs text-brand-400">{String(index + 1).padStart(2, '0')}</span>
              <h2 className="text-lg font-medium">{title}</h2>
              <p className="text-base leading-7 text-ink-2">{copy}</p>
            </section>
          ))}
        </div>
        <p className="mt-8 text-xs leading-5 text-ink-3">
          This page is a product-ready general policy template and should be reviewed against the operating
          company, jurisdiction, and applicable copyright law (including formal DMCA/CDPA counter-notice
          requirements) before a public launch.
        </p>
      </main>
    </div>
  )
}
