import { Link } from 'react-router-dom'
import type { PlanRole } from '@/types/entitlements'

const PLAN_LINK: Record<PlanRole, string> = {
  fan: '/app/subscription',
  artist: '/dashboard/artist/plan',
  dj: '/dj/plan',
}

/**
 * Contextual upgrade CTA shown at the point of friction (a locked feature,
 * a limit reached) — never a generic error message, per the product
 * requirement to explain the benefit of upgrading.
 */
export function UpgradePrompt({ role, reason, cta, className }: { role: PlanRole; reason: string; cta: string; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 px-4 py-3 ${className ?? ''}`}>
      <p className="text-sm text-ink-1">{reason}</p>
      <Link
        to={PLAN_LINK[role]}
        className="shrink-0 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-[#090b06] transition hover:bg-brand-400"
      >
        {cta}
      </Link>
    </div>
  )
}
