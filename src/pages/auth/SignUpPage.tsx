import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { Input, Label, FieldError } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { signInWithGoogle, signUpWithEmail } from '@/services/authService'
import { friendlyAuthError } from '@/utils/authErrors'
import { checkPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/utils/passwordPolicy'

export function SignUpPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const passwordCheck = checkPassword(password)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPasswordTouched(true)
    if (!passwordCheck.valid) return
    setLoading(true)
    try {
      await signUpWithEmail(displayName, email, password)
      navigate('/verify-email')
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      navigate('/onboarding')
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Listen, release music, or work as a DJ — you can add more later.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Display name</Label>
          <Input id="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Create a secure password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setPasswordTouched(true)}
            autoComplete="new-password"
            aria-describedby="password-requirements password-error"
          />
          <p id="password-requirements" className="mt-1.5 text-xs text-ink-3">
            At least {MIN_PASSWORD_LENGTH} characters. Avoid common passwords — passphrases are encouraged.
          </p>
          <PasswordStrengthMeter password={password} />
          {passwordTouched && !passwordCheck.valid ? (
            <div id="password-error">
              {passwordCheck.reasons.map((reason) => (
                <FieldError key={reason}>{reason}</FieldError>
              ))}
            </div>
          ) : null}
        </div>
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Create account
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
        Already have an account?{' '}
        <Link to="/sign-in" className="font-medium text-brand-400 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
