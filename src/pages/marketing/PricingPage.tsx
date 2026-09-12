import { useAuth } from '@/contexts/AuthContext'
import { BrandMark } from '@/components/common/BrandMark'
import { PriceCard } from '@/components/marketing/PriceCard'
import { useSeo } from '@/lib/seo'
import { Link } from 'react-router-dom'

export function PricingPage() {
  const { firebaseUser, profile, hasRole } = useAuth()

  useSeo({
    title: 'Pricing',
    description: 'Listeners and DJs join free. Artists publish for £29.99/year — no revenue percentage. Supporting an artist is a one-off payment straight to them via Stripe, minus a 20% BackTheVibes platform fee. DJs/businesses pay only for the licences they agree to.',
    path: '/pricing',
  })

  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
          <Link to="/"><BrandMark /></Link>
          <Link to="/" className="text-sm font-medium text-ink-2 transition hover:text-white">Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:px-12">
        <div className="text-center">
          <p className="eyebrow">Simple pricing</p>
          <h1 className="mt-4 text-4xl font-medium tracking-[-0.045em] sm:text-6xl">Clear prices. Finite limits. Fair earnings.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-2">
            Listeners and DJs can start free. Artists pay one modest annual membership to publish
            and earn; supporting an artist is a one-off payment, not a subscription.
          </p>
        </div>

        <section className="mt-16">
          <div className="mb-7 flex items-end justify-between gap-6 border-b border-white/10 pb-5">
            <div><p className="eyebrow">For listeners</p><h2 className="mt-2 text-3xl font-medium tracking-[-0.04em]">Listen free. Support artists directly, whenever you want.</h2></div>
            <p className="hidden max-w-sm text-right text-sm leading-6 text-ink-2 md:block">No subscription. Choose an artist and an amount — the rest goes straight to them.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <PriceCard
              index={0}
              featured
              title="Listener account"
              price="Free"
              description="Discover, follow, save, and build your library. Music always plays through the official YouTube player."
              features={['Full music discovery', 'Library and playlists', 'Follow independent artists']}
              cta={firebaseUser ? 'Open your library' : 'Create free account'}
              to={firebaseUser ? '/app' : '/sign-up?role=fan'}
            />
            <PriceCard
              index={1}
              title="Supporting an artist"
              price="You choose"
              description="A one-off payment to one artist, paid directly to them via Stripe."
              features={['You pick the artist and amount', 'BackTheVibes platform fee: 20%', 'The other 80% goes straight to the artist', 'No recurring charge']}
              cta={firebaseUser ? 'Find an artist to support' : 'Create free account'}
              to={firebaseUser ? '/app/discover' : '/sign-up?role=fan'}
            />
          </div>
        </section>

        <section className="mt-20">
          <div className="mb-7 border-b border-white/10 pb-5">
            <p className="eyebrow">For music makers</p>
            <h2 className="mt-2 text-3xl font-medium tracking-[-0.04em]">One affordable year of artist tools.</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {/* One role per account — a signed-in account already holding a
                different role still links through to /onboarding/add-role,
                which explains the block, but the CTA copy says so upfront
                instead of promising a trial/profile the backend will then
                reject. An admin account is unrestricted either way. */}
            {(() => {
              const blockedFromArtist = firebaseUser && !hasRole('artist') && !hasRole('admin') && (profile?.roles.length ?? 0) > 0
              const blockedFromDj = firebaseUser && !hasRole('dj') && !hasRole('admin') && (profile?.roles.length ?? 0) > 0
              return (
                <>
                  <PriceCard index={0} featured title="Artist Membership" price="£29.99" suffix="/year" description="14 days free. About £2.50 a month, billed once yearly. Publish music, build direct fan support, and manage your earnings." features={['14-day free trial', 'Up to 10 stored tracks', 'Releases, analytics and supporter offers', 'DJ outreach, licensing and earnings tools']} cta={firebaseUser && hasRole('artist') ? 'Open artist dashboard' : blockedFromArtist ? 'Unavailable — accounts have one role' : 'Start free trial'} to={firebaseUser ? (hasRole('artist') ? '/dashboard/artist' : '/onboarding/add-role?role=artist') : '/sign-up?role=artist'} />
                  <PriceCard index={1} title="DJ" price="Free" description="Discover releases and agree track licences directly with artists." features={['Direct artist-approved licence requests', 'Filters, crates, notes and analytics', 'Verification and secure downloads']} cta={firebaseUser && hasRole('dj') ? 'Open DJ workspace' : blockedFromDj ? 'Unavailable — accounts have one role' : 'Create DJ profile'} to={firebaseUser ? (hasRole('dj') ? '/dj/discover' : '/onboarding/add-role?role=dj') : '/sign-up?role=dj'} />
                </>
              )
            })()}
          </div>
          <p className="mt-6 text-center text-xs leading-5 text-ink-3">DJ/business licence prices are agreed with each artist and paid directly to them via Stripe. BackTheVibes takes a 10% platform fee; the artist receives the rest.</p>
          <p className="mt-2 text-center text-xs leading-5 text-ink-3">Payouts to your bank happen automatically on Stripe's own schedule once your account is connected and verified — BackTheVibes never holds your earnings.</p>
        </section>

        <p className="mx-auto mt-12 max-w-3xl text-center text-xs leading-5 text-ink-3">
          Platform fees are calculated on the payment amount before Stripe's own processing fees. Exact amounts are recorded for every completed payment.
        </p>
      </main>
    </div>
  )
}
