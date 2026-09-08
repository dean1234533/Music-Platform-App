import { useState } from 'react'
import { changePassword, hasPasswordProvider } from '@/services/authService'
import { exportUserData } from '@/services/accountService'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { checkPassword, MIN_PASSWORD_LENGTH } from '@/utils/passwordPolicy'
import { DeleteAccountModal } from './DeleteAccountModal'
import { PwaInstallSection } from './PwaInstallSection'

/**
 * Change password / download-my-data / delete-account — shared across every
 * dashboard shell (fan Settings, Artist Settings, DJ Profile) so reaching
 * account-level controls never requires crossing into a different layout's
 * nav/mobile-tab set (that used to swap the whole bottom nav out from under
 * an artist/DJ browsing their own dashboard).
 */
export function AccountSecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleChangePassword() {
    setPasswordError(null)
    setPasswordSuccess(false)
    const check = checkPassword(newPassword)
    if (!check.valid) {
      setPasswordError(check.reasons.join(' '))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    setPasswordBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change your password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  async function handleExportData() {
    setExportBusy(true)
    setExportError(null)
    try {
      const { url } = await exportUserData()
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not prepare your data export.')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <>
      <PwaInstallSection />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Password</h2>
        {hasPasswordProvider() ? (
          <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-1 p-4">
            <p className="text-sm font-medium text-ink-0">Change password</p>
            <div>
              <Label>Current password</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <Label>New password</Label>
              <Input type="password" minLength={MIN_PASSWORD_LENGTH} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <PasswordStrengthMeter password={newPassword} />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            {passwordError ? <p className="text-xs text-danger-500">{passwordError}</p> : null}
            {passwordSuccess ? <p className="text-xs text-support-400">Password updated.</p> : null}
            <div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleChangePassword}
                loading={passwordBusy}
                disabled={!currentPassword || !newPassword || !confirmPassword}
              >
                Update password
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-2">You sign in with Google — there is no password to change here.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Privacy</h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-1 px-4 py-3">
            <div>
              <p className="text-sm text-ink-0">Download my data</p>
              <p className="text-xs text-ink-2">Get a copy of your account, content, and activity data.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleExportData} loading={exportBusy}>
              Download
            </Button>
          </div>
          {exportError ? <p className="text-xs text-danger-500">{exportError}</p> : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Account</h2>
        <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
          Delete account
        </Button>
      </section>

      {showDeleteModal ? <DeleteAccountModal onClose={() => setShowDeleteModal(false)} /> : null}
    </>
  )
}
