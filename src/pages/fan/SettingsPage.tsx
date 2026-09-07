import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { updateBasicProfile } from '@/services/userService'
import { signOut } from '@/services/authService'
import { currentPushPermission, disablePushNotifications, enablePushNotifications } from '@/services/pushNotificationService'
import { Button } from '@/components/common/Button'

export function SettingsPage() {
  const { firebaseUser, profile } = useAuth()
  const navigate = useNavigate()
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

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
        <Button
          variant="secondary"
          onClick={async () => {
            await signOut()
            navigate('/')
          }}
        >
          Sign out
        </Button>
      </section>
    </div>
  )
}
