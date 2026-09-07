import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'support'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-500 text-[#080a05] hover:bg-brand-400 shadow-[0_10px_35px_rgba(200,243,63,.12)]',
  secondary: 'bg-white/[0.05] text-ink-0 hover:bg-white/[0.09] border border-white/10',
  ghost: 'bg-transparent text-ink-1 hover:bg-surface-2 hover:text-ink-0',
  danger: 'bg-danger-500 text-white hover:opacity-90',
  support: 'bg-support-500 text-white hover:bg-support-400 shadow-lg shadow-support-500/20',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-3.5 py-2 rounded-full gap-1.5',
  md: 'text-sm px-5 py-2.5 rounded-full gap-2',
  lg: 'text-base px-6 py-3.5 rounded-full gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : null}
      {children}
    </button>
  )
})
