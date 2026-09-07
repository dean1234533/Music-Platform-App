import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { updateBasicProfile } from '@/services/userService'
import { uploadUserAvatar } from '@/services/profileMediaService'
import { validateImageFile } from '@/utils/uploadLimits'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'

const ROLE_LABELS: Record<string, string> = { fan: 'Fan', artist: 'Artist', dj: 'DJ', admin: 'Admin' }

export function ProfilePage() {
  const { firebaseUser, profile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  async function handleSave() {
    if (!firebaseUser) return
    setSaving(true)
    setSaved(false)
    try {
      await updateBasicProfile(firebaseUser.uid, { displayName })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !firebaseUser) return
    const validationError = validateImageFile(file)
    if (validationError) {
      setAvatarError(validationError)
      return
    }
    setAvatarError(null)
    setUploadingAvatar(true)
    try {
      const photoURL = await uploadUserAvatar(firebaseUser.uid, file)
      await updateBasicProfile(firebaseUser.uid, { photoURL })
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not upload photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-0">Profile</h1>
        <Link
          to="/app/settings"
          className="flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-1 hover:bg-surface-3"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface-3 text-xl font-semibold text-ink-1">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
          ) : (
            (profile?.displayName ?? '?').charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-ink-0">{firebaseUser?.email}</p>
          <div className="mt-1 flex gap-1.5">
            {(profile?.roles ?? []).map((role) => (
              <span key={role} className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink-1">
                {ROLE_LABELS[role] ?? role}
              </span>
            ))}
          </div>
          <label className="mt-2 inline-block cursor-pointer rounded-full border border-surface-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-1 hover:bg-surface-3">
            {uploadingAvatar ? 'Uploading…' : 'Change photo'}
            <input type="file" accept="image/*" className="hidden" disabled={uploadingAvatar} onChange={handleAvatarChange} />
          </label>
          {avatarError ? <p className="mt-1 text-xs text-danger-500">{avatarError}</p> : null}
        </div>
      </div>

      <div>
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>

      {saved ? <p className="text-sm text-support-400">Saved.</p> : null}
      <Button onClick={handleSave} loading={saving} className="w-fit">
        Save changes
      </Button>
    </div>
  )
}
