import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { updateBasicProfile } from '@/services/userService'
import { changePassword, hasPasswordProvider, signOut } from '@/services/authService'
import { exportUserData } from '@/services/accountService'
import { currentPushPermission, disablePushNotifications, enablePushNotifications } from '@/services/pushNotificationService'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { DeleteAccountModal } from '@/components/account/DeleteAccountModal'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { checkPassword, MIN_PASSWORD_LENGTH } from '@/utils/passwordPolicy'

export function SettingsPage() {
  const { firebaseUser, profile } = useAuth()
  const navigate = useNavigate()
  const { canInstall, isStandalone, isIOS, install } = useInstallPrompt()
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    setPushPermission(currentPushPermission())
  }, [])

  async function toggleEmailNotifications() {
    if (!firebaseUser || !profile) return
    await updateBasicProfile(firebaseUser.uid, {
      notificationPreferences: {
        ...profile.notificationPreferences,
        email: !profile.notificationPreferences.email,
      },
    })
  }

  async function handleEnablePush() {
    if (!firebaseUser) return
    setPushBusy(true)
    setPushError(null)
    try {
      const result = await enablePushNotifications(firebaseUser.uid)
      if (result === 'unsupported') {
        setPushError("Push notifications aren't supported in this browser.")
      } else {
        setPushPermission(result === 'granted' ? 'granted' : 'denied')
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Could not enable push notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleDisablePush() {
    if (!firebaseUser) return
    setPushBusy(true)
    try {
      await disablePushNotifications(firebaseUser.uid)
    } finally {
      setPushBusy(false)
    }
  }

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
    <div className="flex max-w-lg flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink-0">Settings</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Notifications</h2>
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-1 px-4 py-3">
            <span className="text-sm text-ink-0">Email notifications</span>
            <input
              type="checkbox"
              checked={profile?.notificationPreferences.email ?? true}
              onChange={toggleEmailNotifications}
              className="h-4 w-4 accent-brand-500"
            />
          </label>

          <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-1 px-4 py-3">
            <div>
              <p className="text-sm text-ink-0">Push notifications</p>
              <p className="text-xs text-ink-2">
                {pushPermission === 'granted'
                  ? 'Enabled on this device'
                  : pushPermission === 'denied'
                    ? 'Blocked — allow notifications for this site in your browser settings'
                    : pushPermission === 'unsupported'
                      ? 'Not supported in this browser'
                      : 'Get notified even when the tab is closed'}
              </p>
            </div>
            {pushPermission === 'granted' ? (
              <Button size="sm" variant="secondary" loading={pushBusy} onClick={handleDisablePush}>
                Turn off
              </Button>
            ) : pushPermission === 'denied' || pushPermission === 'unsupported' ? null : (
              <Button size="sm" loading={pushBusy} onClick={handleEnablePush}>
                Enable
              </Button>
            )}
          </div>
          {pushError ? <p className="text-xs text-danger-500">{pushError}</p> : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Roles</h2>
        <div className="flex flex-col gap-2">
          {!profile?.roles.includes('artist') ? (
            <Link
              to="/onboarding/add-role?role=artist"
              className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm font-medium text-ink-0 hover:bg-surface-2"
            >
              + Add an artist profile
            </Link>
          ) : null}
          {!profile?.roles.includes('dj') ? (
            <Link
              to="/onboarding/add-role?role=dj"
              className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm font-medium text-ink-0 hover:bg-surface-2"
            >
              + Add a DJ profile
            </Link>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Security</h2>
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
          <p className="mb-3 text-sm text-ink-2">
            You sign in with Google — there is no password to change here.
          </p>
        )}
        <Button
          className="mt-3"
          variant="secondary"
          onClick={async () => {
            await signOut()
            navigate('/')
          }}
        >
          Sign out
        </Button>
      </section>

      {!isStandalone ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Install App</h2>
          {canInstall ? (
            <Button size="sm" variant="secondary" onClick={() => void install()}>
              Install Wavelength
            </Button>
          ) : isIOS ? (
            <p className="text-sm text-ink-2">
              Tap Share, then "Add to Home Screen" to install Wavelength on this device.
            </p>
          ) : (
            <p className="text-sm text-ink-2">Installation isn't available in this browser yet.</p>
          )}
        </section>
      ) : null}

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
    </div>
  )
}
