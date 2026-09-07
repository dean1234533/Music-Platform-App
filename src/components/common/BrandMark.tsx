export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3" aria-label="Wavelength">
      <img src="/wavelength-mark.svg" alt="" className="h-9 w-9 object-contain" />
      {!compact ? <span className="text-[15px] font-medium tracking-[0.12em] text-ink-0">WAVELENGTH</span> : null}
    </span>
  )
}
