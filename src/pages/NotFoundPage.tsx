import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-surface-0 text-center">
      <h1 className="text-3xl font-semibold text-ink-0">Page not found</h1>
      <p className="text-sm text-ink-2">The page you're looking for doesn't exist.</p>
      <Link to="/" className="text-sm font-medium text-brand-400 hover:underline">
        Back to home
      </Link>
    </div>
  )
}
