export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3" aria-label="Wavelength">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] shadow-[inset_0_1px_rgba(255,255,255,.08)]">
        <span className="h-3.5 w-3.5 rounded-full bg-brand-500 shadow-[0_0_22px_rgba(200,243,63,.45)]" />
        <span className="absolute inset-[5px] rounded-full border border-white/20 border-l-transparent" />
      </span>
      {!compact ? <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink-0">Wavelength</span> : null}
    </span>
  )
}
