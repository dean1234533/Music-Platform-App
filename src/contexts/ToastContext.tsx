import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Check, Info, X, XCircle } from 'lucide-react'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = Date.now() + Math.floor(Math.random() * 1000)
      setToasts((current) => [...current.slice(-2), { id, message, tone }])
      window.setTimeout(() => dismiss(id), 3500)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:top-5 sm:w-96" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#111416]/95 px-4 py-3 text-sm text-ink-0 shadow-[0_20px_60px_rgba(0,0,0,.45)] backdrop-blur-xl"
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                toast.tone === 'error'
                  ? 'bg-danger-500/15 text-danger-500'
                  : toast.tone === 'info'
                    ? 'bg-white/[0.07] text-ink-1'
                    : 'bg-brand-500/15 text-brand-400'
              }`}
            >
              {toast.tone === 'error' ? <XCircle size={16} /> : toast.tone === 'info' ? <Info size={16} /> : <Check size={16} />}
            </span>
            <span className="min-w-0 flex-1 font-medium leading-snug">{toast.message}</span>
            <button type="button" onClick={() => dismiss(toast.id)} className="rounded-full p-1 text-ink-3 hover:bg-white/[0.06] hover:text-ink-0" aria-label="Dismiss notification">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
