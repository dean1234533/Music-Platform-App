import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/common/Button'
import { currentPushPermission, disablePushNotifications, enablePushNotifications } from '@/services/pushNotificationService'

export function PushNotificationControl() {
  const { firebaseUser } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(currentPushPermission)
  const [enabled, setEnabled] = useState(() => currentPushPermission() === 'granted')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enable() {
    if (!firebaseUser) return
    setBusy(true)
    setError(null)
    try {
      const result = await enablePushNotifications(firebaseUser.uid)
      setPermission(result)
      setEnabled(result === 'granted')
      if (result === 'unsupported') setError("Push notifications aren't supported here. On iPhone, install BackTheVibes to your Home Screen and open the installed app.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not activate notifications. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (!firebaseUser) return
    setBusy(true)
    setError(null)
    try {
      await disablePushNotifications(firebaseUser.uid)
      setEnabled(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not turn off notifications. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const description = enabled
    ? 'Enabled on this device'
    : permission === 'denied'
      ? 'Blocked. Allow notifications for BackTheVibes in your device settings.'
      : permission === 'unsupported'
        ? 'On iPhone, notifications require the installed Home Screen app.'
        : 'Receive alerts even when BackTheVibes is closed.'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-surface-border bg-surface-1 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-0">Push notifications</p>
          <p className="mt-0.5 text-xs leading-5 text-ink-2">{description}</p>
        </div>
        {enabled ? (
          <Button className="shrink-0" size="sm" variant="secondary" loading={busy} onClick={disable}>Turn off</Button>
        ) : permission === 'denied' || permission === 'unsupported' ? null : (
          <Button className="shrink-0" size="sm" loading={busy} onClick={enable}>Enable</Button>
        )}
      </div>
      {error ? <p className="text-xs leading-5 text-danger-500">{error}</p> : null}
    </div>
  )
}
