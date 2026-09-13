import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { getCookieConsent, setCookieConsent, type ConsentStatus } from '@/lib/cookieConsent'
import { loadClarity } from '@/lib/clarity'

/**
 * Optional analytics (Microsoft Clarity) only ever loads after Accept —
 * never unconditionally — so this banner is the one gate for it, not a
 * cosmetic add-on. A returning visitor who already accepted gets Clarity
 * loaded silently on mount, with no banner shown again.
 */
export function CookieConsentBanner() {
  const [status, setStatus] = useState<ConsentStatus | null | undefined>(undefined)

  useEffect(() => {
    const existing = getCookieConsent()
    setStatus(existing)
    if (existing === 'accepted') loadClarity()
  }, [])

  function respond(next: ConsentStatus) {
    setCookieConsent(next)
    setStatus(next)
    if (next === 'accepted') loadClarity()
  }

  if (status === undefined || status !== null) return null

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg flex-col gap-3 border border-surface-border bg-surface-1 p-4 shadow-2xl sm:bottom-4 sm:left-4 sm:right-auto sm:rounded-2xl sm:border"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
          <Cookie className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink-0">Cookies</p>
          <p className="mt-0.5 text-xs leading-5 text-ink-2">
            We use optional analytics cookies to understand how people use BackTheVibes. Nothing is set unless you
            accept — see our{' '}
            <Link to="/privacy" className="text-brand-400 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => respond('rejected')}>
          Reject
        </Button>
        <Button size="sm" onClick={() => respond('accepted')}>
          Accept
        </Button>
      </div>
    </div>
  )
}
