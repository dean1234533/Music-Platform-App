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
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-surface-border bg-surface-1/40 px-6 py-16 text-center">
      {icon}
      <h3 className="text-lg font-semibold text-ink-0">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-ink-2">{description}</p> : null}
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
