import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeDJProfile, updateDJProfile } from '@/services/djService'
import { submitVerificationRequest } from '@/services/verificationService'
import { signOut } from '@/services/authService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { LoadingState, EmptyState, ErrorState } from '@/components/common/StateViews'
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection'
import type { DJProfile } from '@/types/dj'

export function DJProfilePage() {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<DJProfile | null>(null)
  const [form, setForm] = useState({ name: '', bio: '', genres: '', country: '', city: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [requestingVerification, setRequestingVerification] = useState(false)
  const [verificationRequested, setVerificationRequested] = useState(false)
  const [showVerificationForm, setShowVerificationForm] = useState(false)
  const [verificationNote, setVerificationNote] = useState('')
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeDJProfile(
      firebaseUser.uid,
      (p) => {
        setProfile(p)
        if (p) {
          setForm({ name: p.name, bio: p.bio, genres: p.genres.join(', '), country: p.country, city: p.city })
        }
      },
      () => setLoadError(true),
    )
  }, [firebaseUser])

  if (!firebaseUser) return <LoadingState />
  if (loadError) return <ErrorState title="Something went wrong" description="Couldn't load this page. Try refreshing." />
  if (!profile) return <EmptyState title="No DJ profile found" description="Add a DJ profile from your account settings." />

  async function handleRequestVerification() {
    if (verificationNote.trim().length < 10) {
      setVerificationError('Tell the admin reviewing this why you should be verified (at least 10 characters).')
      return
    }
    setRequestingVerification(true)
    setVerificationError(null)
    try {
      await submitVerificationRequest({ profileType: 'dj', note: verificationNote.trim() })
      setVerificationRequested(true)
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Could not submit your request.')
    } finally {
      setRequestingVerification(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await updateDJProfile(profile!.djId, {
        name: form.name,
        bio: form.bio,
        genres: form.genres.split(',').map((g) => g.trim()).filter(Boolean),
        country: form.country,
        city: form.city,
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-ink-0">DJ profile</h1>
        {profile.verificationStatus === 'verified' ? <BadgeCheck className="h-5 w-5 text-brand-400" /> : null}
      </div>
      <p className="-mt-4 text-sm text-ink-2">
        Verification status: <span className="text-ink-0">{profile.verificationStatus}</span>. Badges
        only appear once an admin approves your account.
      </p>
      {profile.verificationStatus === 'unverified' && !verificationRequested ? (
        showVerificationForm ? (
          <div className="flex flex-col gap-2 rounded-xl border border-surface-border bg-surface-2 p-3">
            <Label>Why should this account be verified?</Label>
            <TextArea
              rows={3}
              value={verificationNote}
              onChange={(e) => setVerificationNote(e.target.value)}
              placeholder="e.g. links to your official socials/press, venues you've played, why you're notable enough to verify — an admin has nothing else to go on."
            />
            {verificationError ? <p className="text-xs text-danger-500">{verificationError}</p> : null}
            <div className="flex gap-2">
              <Button size="sm" loading={requestingVerification} onClick={handleRequestVerification}>
                Submit request
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowVerificationForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" className="w-fit" onClick={() => setShowVerificationForm(true)}>
            Request verification
          </Button>
        )
      ) : null}

      <div>
        <Label>DJ name</Label>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <Label>Bio</Label>
        <TextArea rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
      </div>
      <div>
        <Label>Genres (comma separated)</Label>
        <Input value={form.genres} onChange={(e) => setForm((f) => ({ ...f, genres: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Country</Label>
          <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
        </div>
        <div>
          <Label>City</Label>
          <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-1">
        <input
          type="checkbox"
          checked={profile.bulkOutreachOptIn}
          onChange={(e) => updateDJProfile(profile.djId, { bulkOutreachOptIn: e.target.checked })}
          className="h-4 w-4 accent-brand-500"
        />
        Receive promotional outreach from artists
      </label>

      {saved ? <p className="text-sm text-support-400">Saved.</p> : null}
      <Button onClick={handleSave} loading={saving} className="w-fit">
        Save changes
      </Button>

      <AccountSecuritySection />

      <Button
        variant="secondary"
        className="w-fit"
        onClick={async () => {
          await signOut()
          navigate('/')
        }}
      >
        Sign out
      </Button>
    </div>
  )
}
