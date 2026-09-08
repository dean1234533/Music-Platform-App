import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/common/Button'
import { signOut } from '@/services/authService'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, profile, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <LoadingState label="Checking your session…" />

  if (!firebaseUser) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />
  }

  if (profile?.suspended) {
    return (
      <main className="grid min-h-svh place-items-center bg-surface-0 px-4 text-center">
        <div className="max-w-md rounded-2xl border border-surface-border bg-surface-1 p-8">
          <h1 className="text-xl font-semibold text-ink-0">Account access suspended</h1>
          <p className="mt-3 text-sm leading-6 text-ink-2">
            This account cannot use protected platform features. Contact support if you believe this is a mistake.
          </p>
          <Button className="mt-6" variant="secondary" onClick={() => void signOut().then(() => window.location.assign('/'))}>
            Sign out
          </Button>
        </div>
      </main>
    )
  }

  return <>{children}</>
}

export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { profile, initializing } = useAuth()

  if (initializing) return <LoadingState label="Loading your profile…" />

  if (!profile || !profile.onboardingComplete) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
