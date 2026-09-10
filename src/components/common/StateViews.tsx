import type { ReactNode } from 'react'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-2">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-surface-3 border-t-brand-400" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  backgroundImage,
  backgroundPosition,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  backgroundImage?: string
  backgroundPosition?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border bg-surface-1/40 bg-cover bg-center px-6 py-16 text-center ${
        backgroundImage ? 'border-white/10 shadow-[inset_0_1px_rgba(255,255,255,0.06)]' : 'border-dashed border-surface-border'
      }`}
      style={
        backgroundImage
          ? {
              backgroundImage: `linear-gradient(90deg, rgba(5, 6, 7, 0.78), rgba(5, 6, 7, 0.6) 50%, rgba(5, 6, 7, 0.78)), url("${backgroundImage}")`,
              backgroundPosition,
            }
          : undefined
      }
    >
      {icon}
      <h3 className="text-lg font-semibold text-ink-0">{title}</h3>
      {description ? <p className={`max-w-sm text-sm ${backgroundImage ? 'text-ink-1' : 'text-ink-2'}`}>{description}</p> : null}
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger-500/30 bg-danger-500/5 px-6 py-16 text-center">
      <h3 className="text-lg font-semibold text-ink-0">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-ink-2">{description}</p> : null}
      {action}
    </div>
  )
}
