const CONSENT_KEY = 'cookieConsent'

export type ConsentStatus = 'accepted' | 'rejected'

/** null means "no choice made yet" — the banner should still show. */
export function getCookieConsent(): ConsentStatus | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(CONSENT_KEY)
  return value === 'accepted' || value === 'rejected' ? value : null
}

export function setCookieConsent(status: ConsentStatus): void {
  window.localStorage.setItem(CONSENT_KEY, status)
}
