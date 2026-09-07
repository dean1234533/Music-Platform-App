import { Link } from 'react-router-dom'
/** Contextual supporter CTA. Creator and DJ features are never gated here. */
export function UpgradePrompt({ reason, cta, className }: { role?: 'fan'; reason: string; cta: string; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 px-4 py-3 ${className ?? ''}`}>
      <p className="text-sm text-ink-1">{reason}</p>
      <Link
        to="/app/subscription"
        className="shrink-0 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-[#090b06] transition hover:bg-brand-400"
      >
        {cta}
      </Link>
    </div>
  )
}
