import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { clsx } from 'clsx'

const fieldClasses =
  'w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-ink-0 placeholder:text-ink-3 outline-none transition focus:border-brand-500/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-brand-500/10 disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={clsx(fieldClasses, className)} {...rest} />
  },
)

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={clsx(fieldClasses, 'resize-none', className)} {...rest} />
  },
)

export function Label({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink-2">
      {children}
    </label>
  )
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null
  return <p className="mt-1.5 text-xs text-danger-500">{children}</p>
}
