import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { listActiveSubscriptionPlansForRole } from '@/services/platformSettingsService'
import { LoadingState } from '@/components/common/StateViews'
import { BrandMark } from '@/components/common/BrandMark'
import { PriceCard } from '@/components/marketing/PriceCard'
import { formatCurrency } from '@/utils/format'
import { PLAN_ROLES, type PlanFeatureKey, type PlanRole } from '@/types/entitlements'
import type { SubscriptionPlan } from '@/types/platformSettings'

const ROLE_LABELS: Record<PlanRole, string> = { fan: 'Fans', artist: 'Artists', dj: 'DJs' }

const FEATURE_LABELS: Partial<Record<PlanFeatureKey, string>> = {
  supporterContent: 'Supporter-only posts & tracks',
  earlyAccess: 'Early access to releases',
  polls: 'Supporter-only polls',
  artistDefinedPerks: 'Artist-defined perks',
  unlimitedTracks: 'Unlimited track uploads',
  albumsEps: 'Albums & EPs',
  scheduledReleases: 'Scheduled releases',
  supporterOnlyTracks: 'Supporter-only tracks',
  advancedAnalytics: 'Advanced analytics',
  fixedCustomDjPricing: 'Fixed & custom DJ licence pricing',
  teamAccess: 'Team / manager access',
  bulkDjOutreach: 'Bulk DJ outreach (opted-in DJs)',
  privatePromoReleases: 'Private DJ promo releases',
  releaseEmbargoes: 'Release embargo dates',
  exportableAnalytics: 'Exportable analytics',
  unlimitedDjRequests: 'Unlimited DJ requests',
  crates: 'Crates',
  verifiedDjEligible: 'Verified DJ application',
  advancedFiltering: 'Advanced discovery filtering',
  privatePromoPools: 'Access to private promo pools',
  advancedCrates: 'Advanced crates (notes & tags)',
  professionalAnalytics: 'Professional analytics',
  priorityAccess: 'Priority access to drops',
}

function planFeatureLabels(plan: SubscriptionPlan): string[] {
  return Object.entries(plan.features)
    .filter(([, enabled]) => enabled)
    .map(([key]) => FEATURE_LABELS[key as PlanFeatureKey] ?? key)
}

function ctaFor(plan: SubscriptionPlan, role: PlanRole, hasRole: (role: 'fan' | 'artist' | 'dj') => boolean, signedIn: boolean): { label: string; to: string } {
  if (!signedIn) return { label: 'Create free account', to: `/sign-up?role=${role}` }
  if (role !== 'fan' && !hasRole(role)) {
    return { label: `Add ${ROLE_LABELS[role].toLowerCase().slice(0, -1)} profile`, to: '/onboarding/add-role' }
  }
  const dest = role === 'fan' ? '/app/subscription' : role === 'artist' ? '/dashboard/artist/plan' : '/dj/plan'
  return { label: plan.priceMinor === 0 ? 'Get started' : 'Subscribe', to: dest }
}

export function PricingPage() {
  const { firebaseUser, hasRole } = useAuth()
  const [role, setRole] = useState<PlanRole>('fan')
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)

  useEffect(() => {
    setPlans(null)
    void listActiveSubscriptionPlansForRole(role).then(setPlans)
  }, [role])

  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link to="/"><BrandMark /></Link>
        <Link to="/" className="text-sm font-medium text-ink-2 transition hover:text-white">Back to home</Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:px-12">
        <div className="text-center">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-4 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">Free to join. Upgrade when it's worth it.</h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink-2">
            Artists can join free and start building an audience before paying for professional
            tools — every tier here has a real free option.
          </p>
        </div>

        <div className="mx-auto mt-10 flex w-fit gap-1 rounded-full border border-white/[0.08] bg-surface-1 p-1">
          {PLAN_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                role === r ? 'bg-brand-500 text-[#090b06]' : 'text-ink-2 hover:text-white'
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>

        {plans === null ? (
          <div className="mt-16"><LoadingState /></div>
        ) : (
          <div className="mt-12 grid gap-3 md:grid-cols-3">
            {plans.map((plan, index) => {
              const cta = ctaFor(plan, role, hasRole, !!firebaseUser)
              return (
                <PriceCard
                  key={plan.planId}
                  index={index}
                  featured={plan.recommended}
                  title={plan.name}
                  price={plan.priceMinor === 0 ? 'Free' : formatCurrency(plan.priceMinor, plan.currency)}
                  suffix={plan.priceMinor === 0 ? undefined : `/${plan.interval}`}
                  description={plan.isDefaultFree ? `Start building on ${ROLE_LABELS[role].toLowerCase()} for free.` : 'Everything in the tier below, plus:'}
                  features={planFeatureLabels(plan)}
                  cta={cta.label}
                  to={cta.to}
                />
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
