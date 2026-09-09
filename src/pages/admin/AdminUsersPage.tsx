import { useEffect, useState } from 'react'
import { adminDeleteAccount, adminSetUserSuspension, listUsers } from '@/services/adminService'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { LoadingState } from '@/components/common/StateViews'
import type { UserProfile } from '@/types/user'

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[] | null>(null)
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)

  useEffect(() => {
    void listUsers().then(setUsers)
  }, [])

  async function toggleSuspension(user: UserProfile) {
    setBusyUid(user.uid)
    try {
      await adminSetUserSuspension({ userId: user.uid, suspended: !user.suspended })
      setUsers((prev) => prev?.map((u) => (u.uid === user.uid ? { ...u, suspended: !u.suspended } : u)) ?? null)
    } finally {
      setBusyUid(null)
    }
  }

  async function handleDeleted(uid: string) {
    setUsers((prev) => prev?.filter((u) => u.uid !== uid) ?? null)
    setDeleteTarget(null)
  }

  if (users === null) return <LoadingState />

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Users</h1>
      <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
        {users.map((user) => (
          <div key={user.uid} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-0">{user.displayName ?? user.email}</p>
              <p className="text-xs text-ink-2">{user.roles.join(', ') || 'no roles'}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={user.suspended ? 'secondary' : 'danger'}
                loading={busyUid === user.uid}
                onClick={() => toggleSuspension(user)}
              >
                {user.suspended ? 'Unsuspend' : 'Suspend'}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteTarget(user)}>
                Delete account
              </Button>
            </div>
          </div>
        ))}
      </div>

      {deleteTarget ? (
        <AdminDeleteAccountModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />
      ) : null}
    </div>
  )
}

function AdminDeleteAccountModal({
  user,
  onClose,
  onDeleted,
}: {
  user: UserProfile
  onClose: () => void
  onDeleted: (uid: string) => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await adminDeleteAccount({ userId: user.uid })
      onDeleted(user.uid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account deletion failed. It is safe to try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-surface-border bg-surface-1 p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink-0">Delete account</h2>
        <p className="mt-2 text-sm text-ink-1">
          This permanently deletes <span className="font-medium text-ink-0">{user.displayName ?? user.email}</span>
          {' '}({user.email}) — Firebase Auth user, profile, uploaded content not covered by an active licence,
          playlists, follows, and cancels any Stripe subscription. Signed DJ licence agreements and financial
          records are retained per the standard retention schedule. This cannot be undone.
        </p>
        <div className="mt-4">
          <Label>{'Type DELETE to confirm'}</Label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
        </div>
        {error ? <p className="mt-2 text-sm text-danger-500">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" loading={busy} disabled={confirmText !== 'DELETE'} onClick={() => void handleDelete()}>
            Permanently delete account
          </Button>
        </div>
      </div>
    </div>
  )
}
