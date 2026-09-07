import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/common/Button'
import { useAuth } from '@/contexts/AuthContext'
import { resendVerificationEmail } from '@/services/authService'
import { auth } from '@/lib/firebase'

export function VerifyEmailPage() {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const [sent, setSent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    setError(null)
    try {
      await resendVerificationEmail()
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the email.')
    }
  }

  async function handleContinue() {
    setChecking(true)
    try {
      await auth.currentUser?.reload()
      navigate('/onboarding')
    } finally {
      setChecking(false)
    }
  }

  return (
    <AuthLayout title="Verify your email">
      <div className="flex flex-col items-center gap-4 text-center">
        <MailCheck className="h-10 w-10 text-brand-400" />
        <p className="text-sm text-ink-1">
          We sent a verification link to{' '}
          <span className="font-medium text-ink-0">{firebaseUser?.email}</span>. You can continue
          setting up your account now and verify whenever the email arrives.
        </p>
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        {sent ? <p className="text-sm text-support-400">Verification email sent.</p> : null}
        <div className="flex w-full flex-col gap-2">
          <Button onClick={handleContinue} loading={checking} className="w-full">
            Continue
          </Button>
          <Button variant="secondary" onClick={handleResend} className="w-full">
            Resend email
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
