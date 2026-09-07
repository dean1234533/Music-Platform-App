import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Music2 } from 'lucide-react'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-0 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <Music2 className="h-6 w-6 text-brand-400" />
          <span className="text-lg font-semibold text-ink-0">Wavelength</span>
        </Link>
        <div className="rounded-2xl border border-surface-border bg-surface-1 p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-ink-0">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-ink-2">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
