import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { listActiveSubscriptionPlansForRole } from '@/services/platformSettingsService'
import { LoadingState } from '@/components/common/StateViews'
import { BrandMark } from '@/components/common/BrandMark'
import { PriceCard } from '@/components/marketing/PriceCard'
import { formatCurrency } from '@/utils/format'
import type { PlanFeatureKey } from '@/types/entitlements'
import type { SubscriptionPlan } from '@/types/platformSettings'

const FEATURE_LABELS: Partial<Record<PlanFeatureKey, string>> = {
  supporterContent: 'Supporter-only posts & tracks',
  earlyAccess: 'Early access to releases',
  polls: 'Supporter-only polls',
  artistDefinedPerks: 'Artist-defined perks',
}

function featureLabels(plan: SubscriptionPlan): string[] {
  return Object.entries(plan.features)
    .filter(([, enabled]) => enabled)
    .map(([key]) => FEATURE_LABELS[key as PlanFeatureKey] ?? key)
}

export function PricingPage() {
  const { firebaseUser, hasRole } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)

  useEffect(() => { void listActiveSubscriptionPlansForRole('fan').then(setPlans) }, [])

  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link to="/"><BrandMark /></Link>
        <Link to="/" className="text-sm font-medium text-ink-2 transition hover:text-white">Back to home</Link>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:px-12">
        <div className="text-center">
          <p className="eyebrow">Simple pricing</p>
          <h1 className="mt-4 text-4xl font-medium tracking-[-0.045em] sm:text-6xl">Create for free. Support by choice.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-2">
            Artists and DJs get the complete platform without subscriptions or artificial limits. Listener memberships fund the artists fans choose.
          </p>
        </div>

        <section className="mt-16">
          <div className="mb-7 flex items-end justify-between gap-6 border-b border-white/10 pb-5">
            <div><p className="eyebrow">For listeners</p><h2 className="mt-2 text-3xl font-medium tracking-[-0.04em]">Listen free, or become a supporter.</h2></div>
            <p className="hidden max-w-sm text-right text-sm leading-6 text-ink-2 md:block">Supporter pricing is set by the platform and billed securely through Stripe.</p>
          </div>
          {plans === null ? <LoadingState /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((plan, index) => (
                <PriceCard
                  key={plan.planId}
                  index={index}
                  featured={plan.recommended}
                  title={plan.name}
                  price={plan.priceMinor === 0 ? 'Free' : formatCurrency(plan.priceMinor, plan.currency)}
                  suffix={plan.priceMinor === 0 ? undefined : `/${plan.interval}`}
                  description={plan.isDefaultFree ? 'Discover, follow, save, and build your library.' : 'Direct your monthly support to the independent artists you choose.'}
                  features={plan.isDefaultFree ? ['Full music discovery', 'Library and playlists', 'Follow independent artists'] : featureLabels(plan)}
                  cta={firebaseUser ? (plan.priceMinor === 0 ? 'Open your library' : 'Manage subscription') : 'Create free account'}
                  to={firebaseUser ? '/app/subscription' : '/sign-up?role=fan'}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-20">
          <div className="mb-7 border-b border-white/10 pb-5">
            <p className="eyebrow">For music makers</p>
            <h2 className="mt-2 text-3xl font-medium tracking-[-0.04em]">No creator subscription. No upgrade wall.</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <PriceCard index={0} title="Artist" price="Free" description="Release music, grow supporters, reach opted-in DJs, and manage revenue." features={['Unlimited track uploads', 'Releases, analytics and supporter content', 'DJ outreach, licensing and payouts']} cta={firebaseUser && hasRole('artist') ? 'Open artist dashboard' : 'Create artist profile'} to={firebaseUser ? (hasRole('artist') ? '/dashboard/artist' : '/onboarding/add-role') : '/sign-up?role=artist'} />
            <PriceCard index={1} title="DJ" price="Free" description="Discover releases and agree track licences directly with artists." features={['Unlimited licence requests', 'Filters, crates, notes and analytics', 'Verification and secure downloads']} cta={firebaseUser && hasRole('dj') ? 'Open DJ workspace' : 'Create DJ profile'} to={firebaseUser ? (hasRole('dj') ? '/dj/discover' : '/onboarding/add-role') : '/sign-up?role=dj'} />
          </div>
          <p className="mt-6 text-center text-xs leading-5 text-ink-3">DJ licence prices are agreed with each artist. The configured transaction fee and artist proceeds are shown before payment.</p>
        </section>
      </main>
    </div>
  )
}
