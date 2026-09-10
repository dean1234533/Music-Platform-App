import { useNavigate, useLocation } from 'react-router-dom'

/**
 * navigate(-1) silently does nothing useful when the current page has no
 * in-app history behind it — reached via a direct link, a shared URL, a new
 * tab, or after a service-worker reload. React Router marks that case with
 * location.key === 'default'.
 *
 * In the installed PWA, though, location.key alone is unreliable: iOS/Android
 * frequently discard and recreate the WebView's JS context while keeping the
 * browser's real session-history stack intact — e.g. resuming from the OS app
 * switcher, or reopening after the OS reclaimed memory while the app was
 * backgrounded. That gives a fresh React Router instance a location.key of
 * 'default' even though real "came from" history still exists one entry back.
 * window.history.state (where React Router persists { idx, key }) survives
 * that recreation because it's tied to the browser's actual history entry,
 * not to the JS context — so check it first and only trust location.key when
 * that state is unavailable (e.g. a genuinely fresh tab/deep link).
 */
export function useSmartBack(fallbackPath: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    const historyState = window.history.state as { idx?: number } | null
    const hasRealHistory = typeof historyState?.idx === 'number' ? historyState.idx > 0 : location.key !== 'default'
    if (hasRealHistory) {
      navigate(-1)
    } else {
      navigate(fallbackPath)
    }
  }
}
