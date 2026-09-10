import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { updateBasicProfile, removeRole } from '@/services/userService'
import { signOut } from '@/services/authService'
import { Button } from '@/components/common/Button'
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection'
import { PushNotificationControl } from '@/components/notifications/PushNotificationControl'

export function SettingsPage() {
  const { firebaseUser, profile, hasRole } = useAuth()
  const navigate = useNavigate()
  const [removingRole, setRemovingRole] = useState(false)

  async function toggleEmailNotifications() {
    if (!firebaseUser || !profile) return
    await updateBasicProfile(firebaseUser.uid, {
      notificationPreferences: {
        ...profile.notificationPreferences,
        email: !profile.notificationPreferences.email,
      },
    })
  }

  async function handleRemoveFanRole() {
    if (!firebaseUser) return
    if (!window.confirm("Step back from the fan role? You'll lose access to browsing/discovery (following, library, playlists) until you add it back. Nothing is deleted.")) {
      return
    }
    setRemovingRole(true)
    try {
      await removeRole(firebaseUser.uid, 'fan')
      navigate('/')
    } finally {
      setRemovingRole(false)
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

          <PushNotificationControl />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Roles</h2>
        <div className="flex flex-col gap-2">
          {profile?.roles.includes('artist') ? (
            <Link
              to="/dashboard/artist"
              className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm font-medium text-ink-0 hover:bg-surface-2"
            >
              Go to Artist dashboard →
            </Link>
          ) : (
            <Link
              to="/onboarding/add-role?role=artist"
              className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm font-medium text-ink-0 hover:bg-surface-2"
            >
              + Add an artist profile
            </Link>
          )}
          {profile?.roles.includes('dj') ? (
            <Link
              to="/dj/discover"
              className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm font-medium text-ink-0 hover:bg-surface-2"
            >
              Go to DJ dashboard →
            </Link>
          ) : (
            <Link
              to="/onboarding/add-role?role=dj"
              className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm font-medium text-ink-0 hover:bg-surface-2"
            >
              + Add a DJ profile
            </Link>
          )}
        </div>
      </section>

      <AccountSecuritySection />

      {profile?.roles.includes('fan') && hasRole('admin') ? (
        <section className="flex flex-col gap-2 rounded-xl border border-danger-500/20 bg-danger-500/[0.03] p-4">
          <p className="text-sm font-semibold text-ink-0">Step back from fan (admin only)</p>
          <p className="text-xs leading-5 text-ink-2">Removes browsing/discovery access until you add the fan role back. Nothing is deleted. Only visible to admin accounts.</p>
          <Button variant="danger" size="sm" className="w-fit" loading={removingRole} onClick={handleRemoveFanRole}>
            Remove fan role
          </Button>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Session</h2>
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
