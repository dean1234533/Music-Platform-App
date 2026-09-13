/**
 * Microsoft Clarity (session recording/heatmaps) — an optional analytics
 * cookie, so this only ever loads after the visitor accepts the cookie
 * consent banner (see CookieConsentBanner.tsx), never unconditionally.
 */
const CLARITY_PROJECT_ID = 'yhsltm5baj'

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void
  }
}

export function loadClarity(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.clarity) return // already loaded

  const w = window
  w.clarity = function (...args: unknown[]) {
    const queued = w.clarity as unknown as { q?: unknown[] }
    queued.q = queued.q || []
    queued.q.push(args)
  }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`
  const firstScript = document.getElementsByTagName('script')[0]
  firstScript.parentNode?.insertBefore(script, firstScript)
}
