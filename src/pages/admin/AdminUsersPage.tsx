import { useEffect, useState } from 'react'
import { adminSetUserSuspension, listUsers } from '@/services/adminService'
import { Button } from '@/components/common/Button'
import { LoadingState } from '@/components/common/StateViews'
import type { UserProfile } from '@/types/user'

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[] | null>(null)
  const [busyUid, setBusyUid] = useState<string | null>(null)

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
            <Button
              size="sm"
              variant={user.suspended ? 'secondary' : 'danger'}
              loading={busyUid === user.uid}
              onClick={() => toggleSuspension(user)}
            >
              {user.suspended ? 'Unsuspend' : 'Suspend'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
