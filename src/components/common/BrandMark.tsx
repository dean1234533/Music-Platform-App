export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center" aria-label="Wavelength — independent sound">
      <span className="leading-none">
        <span className="wordmark block text-[1.45rem] text-ink-0">Wave<span className="italic">length</span></span>
        {!compact ? <span className="mt-1 block pl-0.5 text-[0.47rem] font-semibold uppercase tracking-[0.34em] text-brand-400">Independent sound</span> : null}
      </span>
    </span>
  )
}
