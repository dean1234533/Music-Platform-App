export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 64

/**
 * A local, always-available common-password blocklist. This is deliberately
 * not a Have I Been Pwned integration — HIBP's k-anonymity range API would
 * be the natural next step, but that means sending a request (even a
 * partial hash prefix) to a third party on every signup/password change,
 * which needs its own privacy-review sign-off first. This blocklist covers
 * the obvious cases (the exact list called out in the audit brief plus
 * common variants) without any external dependency or data leaving the
 * browser. REQUIRES LEGAL / PRIVACY REVIEW BEFORE PRODUCTION if HIBP
 * checking is added later — document the third-party disclosure it involves
 * even under k-anonymity.
 */
const COMMON_PASSWORDS = new Set([
  '123456', '123456789', '12345678', '1234567890', '1234567', '12345',
  'password', 'password1', 'password123', 'passw0rd',
  'qwerty', 'qwerty123', 'qwertyuiop',
  '111111', '000000', '123123', '696969',
  'abc123', 'abcdef', 'abcdefgh',
  'letmein', 'admin', 'welcome', 'welcome1', 'iloveyou',
  'monkey', 'dragon', 'football', 'baseball', 'sunshine',
  'princess', 'shadow', 'master', 'superman', 'trustno1',
  'letmein123', 'starwars', '1q2w3e4r', 'zaq1zaq1',
])

export interface PasswordCheckResult {
  valid: boolean
  reasons: string[]
}

/**
 * Client-side defense-in-depth only — bypassable by anyone calling the
 * Firebase Auth API directly. Real server-side enforcement of length/
 * complexity requires enabling Identity Platform's password policy for this
 * Firebase project (see functions/src/admin/passwordPolicy.ts), which is a
 * one-time admin action, not something this function can do on its own.
 */
export function checkPassword(password: string): PasswordCheckResult {
  const reasons: string[] = []
  if (password.length < MIN_PASSWORD_LENGTH) {
    reasons.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    reasons.push(`Use at most ${MAX_PASSWORD_LENGTH} characters.`)
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().trim())) {
    reasons.push('This password is too common — choose something less guessable.')
  }
  return { valid: reasons.length === 0, reasons }
}
