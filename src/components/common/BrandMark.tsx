export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center" aria-label="BackTheVibes — independent sound">
      <span className="leading-none">
        <span className="wordmark block text-[1.12rem] text-ink-0 sm:text-[1.45rem]">Back<span className="italic">TheVibes</span></span>
        {!compact ? <span className="mt-1 block pl-0.5 text-[0.4rem] font-semibold uppercase tracking-[0.22em] text-brand-400 sm:text-[0.47rem] sm:tracking-[0.34em]">Independent sound</span> : null}
      </span>
    </span>
  )
}
