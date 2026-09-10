import { useNavigate, useLocation } from 'react-router-dom'

/**
 * navigate(-1) silently does nothing useful when the current page has no
 * in-app history behind it — reached via a direct link, a shared URL, a new
 * tab, or after a service-worker reload. React Router marks that case with
 * location.key === 'default'; fall back to a real destination instead of a
 * back button that appears broken.
 */
export function useSmartBack(fallbackPath: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (location.key === 'default') {
      navigate(fallbackPath)
    } else {
      navigate(-1)
    }
  }
}
