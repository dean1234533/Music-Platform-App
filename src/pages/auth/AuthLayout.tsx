import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '@/components/common/BrandMark'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-surface-0 px-4 py-10">
      <div className="absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-500/[0.055] blur-3xl" />
      <div className="w-full max-w-sm">
        <Link to="/" className="relative mb-9 flex items-center justify-center"><BrandMark /></Link>
        <div className="premium-panel relative rounded-[1.5rem] p-6 sm:p-8">
          <h1 className="text-2xl font-medium tracking-[-0.03em] text-ink-0">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-ink-2">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
