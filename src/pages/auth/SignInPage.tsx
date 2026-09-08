import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { Input, Label } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { signInWithEmail, signInWithGoogle, signOut } from '@/services/authService'
import { friendlyAuthError } from '@/utils/authErrors'
import { ensureUserDocument, getUserProfile } from '@/services/userService'
import type { User } from 'firebase/auth'

const SUSPENDED_MESSAGE = 'This account has been suspended. Contact support if you believe this is a mistake.'

/** Thrown to short-circuit sign-in for a suspended account before it ever reaches a protected route. */
class SuspendedAccountError extends Error {}

async function dashboardAfterSignIn(user: User): Promise<string> {
  await ensureUserDocument(user)
  const profile = await getUserProfile(user.uid)
  if (profile?.suspended) {
    await signOut()
    throw new SuspendedAccountError(SUSPENDED_MESSAGE)
  }
  if (!profile?.onboardingComplete) return '/onboarding'
  if (profile.roles.includes('admin')) return '/admin/users'
  if (profile.roles.includes('artist')) return '/dashboard/artist'
  if (profile.roles.includes('dj')) return '/dj/discover'
  return '/app/home'
}

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from
  const redirectTo = from ? `${from.pathname}${from.search}` : null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const credential = await signInWithEmail(email, password)
      navigate(redirectTo ?? (await dashboardAfterSignIn(credential.user)))
    } catch (err) {
      setError(err instanceof SuspendedAccountError ? err.message : friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      const credential = await signInWithGoogle()
      navigate(redirectTo ?? (await dashboardAfterSignIn(credential.user)))
    } catch (err) {
      setError(err instanceof SuspendedAccountError ? err.message : friendlyAuthError(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="mb-1.5 text-xs font-medium text-brand-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-surface-border" />
        or
        <span className="h-px flex-1 bg-surface-border" />
      </div>

      <Button variant="secondary" className="w-full" loading={googleLoading} onClick={handleGoogle}>
        Continue with Google
      </Button>

      <p className="mt-6 text-center text-sm text-ink-2">
        Don&apos;t have an account?{' '}
        <Link to="/sign-up" className="font-medium text-brand-400 hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}
