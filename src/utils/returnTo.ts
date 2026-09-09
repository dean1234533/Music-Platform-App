/**
 * Validates a `returnTo` value pulled from a query string before ever
 * navigating to it. Must be a same-origin relative path — rejects anything
 * that could act as an open redirect (a full URL, `//evil.com`, `/\evil.com`,
 * which some browsers treat as protocol-relative too).
 */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path) return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//') || path.startsWith('/\\')) return false
  return true
}
