import { useEffect, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistProfile, updateArtistProfile } from '@/services/artistService'
import { subscribeOwnVerificationRequests, submitVerificationRequest } from '@/services/verificationService'
import { uploadArtistCover, uploadArtistPhoto } from '@/services/profileMediaService'
import { signOut } from '@/services/authService'
import { removeRole } from '@/services/userService'
import { openBillingPortal, subscribeToOwnSubscription, subscribeToPlan } from '@/services/subscriptionService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { LoadingState, EmptyState } from '@/components/common/StateViews'
import { AccountSecuritySection } from '@/components/account/AccountSecuritySection'
import { validateImageFile } from '@/utils/uploadLimits'
import type { ArtistProfile, DJRequestPolicy } from '@/types/artist'
import type { SubscriptionDoc } from '@/types/subscription'

const DJ_POLICY_OPTIONS: { value: DJRequestPolicy; label: string }[] = [
  { value: 'anyone', label: 'Anyone' },
  { value: 'verified_only', label: 'Verified DJs only' },
  { value: 'approved_only', label: 'DJs I approve' },
  { value: 'disabled', label: 'Disabled' },
]

export function ArtistSettingsPage() {
  const { firebaseUser, hasRole } = useAuth()
  const navigate = useNavigate()
  const [artist, setArtist] = useState<ArtistProfile | null>(null)
  const [removingRole, setRemovingRole] = useState(false)

  async function handleRemoveArtistRole() {
    if (!firebaseUser) return
    if (
      !window.confirm(
        'Step back from your artist role? Your public artist profile and tracks stop being visible to anyone — including on shared links — until you add the artist role back. Nothing is deleted.',
      )
    ) {
      return
    }
    setRemovingRole(true)
    try {
      await removeRole(firebaseUser.uid, 'artist')
      navigate('/')
    } finally {
      setRemovingRole(false)
    }
  }
  const [form, setForm] = useState<{ name: string; bio: string; genres: string; location: string; website: string }>({
    name: '',
    bio: '',
    genres: '',
    location: '',
    website: '',
  })
  const [djAllowRequests, setDjAllowRequests] = useState<DJRequestPolicy>('verified_only')
  const [storiesDjEnabled, setStoriesDjEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [verificationRequested, setVerificationRequested] = useState(false)
  const [requestingVerification, setRequestingVerification] = useState(false)
  const [showVerificationForm, setShowVerificationForm] = useState(false)
  const [verificationNote, setVerificationNote] = useState('')
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistProfile(firebaseUser.uid, (profile) => {
      setArtist(profile)
      if (profile) {
        setForm({
          name: profile.name,
          bio: profile.bio,
          genres: profile.genres.join(', '),
          location: profile.location,
          website: profile.socialLinks.website ?? '',
        })
        setDjAllowRequests(profile.djAllowRequests)
        setStoriesDjEnabled(profile.storiesDjEnabled)
      }
    })
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeOwnVerificationRequests(firebaseUser.uid, (rows) => {
      setVerificationRequested(rows.some((r) => r.profileType === 'artist' && r.status === 'pending'))
    })
  }, [firebaseUser])

  async function handleRequestVerification() {
    if (verificationNote.trim().length < 10) {
      setVerificationError('Tell the admin reviewing this why you should be verified (at least 10 characters).')
      return
    }
    setRequestingVerification(true)
    setVerificationError(null)
    try {
      await submitVerificationRequest({ profileType: 'artist', note: verificationNote.trim() })
      setVerificationRequested(true)
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Could not submit your request.')
    } finally {
      setRequestingVerification(false)
    }
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !firebaseUser) return
    const validationError = validateImageFile(file)
    if (validationError) {
      setPhotoError(validationError)
      return
    }
    setPhotoError(null)
    setUploadingPhoto(true)
    try {
      const photoURL = await uploadArtistPhoto(firebaseUser.uid, file)
      await updateArtistProfile(firebaseUser.uid, { photoURL })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not upload photo.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !firebaseUser) return
    const validationError = validateImageFile(file)
    if (validationError) {
      setPhotoError(validationError)
      return
    }
    setPhotoError(null)
    setUploadingCover(true)
    try {
      const coverURL = await uploadArtistCover(firebaseUser.uid, file)
      await updateArtistProfile(firebaseUser.uid, { coverURL })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not upload cover.')
    } finally {
      setUploadingCover(false)
    }
  }

  if (!firebaseUser) return <LoadingState />
  if (!artist) return <EmptyState title="No artist profile found" description="Add an artist profile from Settings on your account." />

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const nextSocialLinks = { ...artist!.socialLinks }
      if (form.website.trim()) {
        nextSocialLinks.website = form.website.trim()
      } else {
        delete nextSocialLinks.website
      }
      await updateArtistProfile(artist!.artistId, {
        name: form.name,
        nameLower: form.name.toLowerCase(),
        bio: form.bio,
        genres: form.genres.split(',').map((g) => g.trim()).filter(Boolean),
        location: form.location,
        socialLinks: nextSocialLinks,
        djAllowRequests,
        storiesDjEnabled,
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink-0">Artist settings</h1>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
            {artist.photoURL ? <img src={artist.photoURL} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-full border border-surface-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-1 hover:bg-surface-3">
                {uploadingPhoto ? 'Uploading…' : 'Change photo'}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={handlePhotoChange} />
              </label>
              <label className="cursor-pointer rounded-full border border-surface-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-1 hover:bg-surface-3">
                {uploadingCover ? 'Uploading…' : 'Change cover'}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingCover} onChange={handleCoverChange} />
              </label>
            </div>
            <p className="text-xs text-ink-3">Resized and compressed automatically.</p>
            {photoError ? <p className="text-xs text-danger-500">{photoError}</p> : null}
          </div>
        </div>
        <div>
          <Label>Artist name</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <Label>Biography</Label>
          <TextArea rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
        </div>
        <div>
          <Label>Genres (comma separated)</Label>
          <Input value={form.genres} onChange={(e) => setForm((f) => ({ ...f, genres: e.target.value }))} />
        </div>
        <div>
          <Label>Location</Label>
          <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
        <div>
          <Label>Website</Label>
          <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">DJ permissions</h2>
        <Label>Allow DJ requests</Label>
        <select
          value={djAllowRequests}
          onChange={(e) => setDjAllowRequests(e.target.value as DJRequestPolicy)}
          className="w-full rounded-lg border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-0"
        >
          {DJ_POLICY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Stories</h2>
        <label className="flex items-center gap-2.5 text-sm text-ink-1">
          <input
            type="checkbox"
            checked={storiesDjEnabled}
            onChange={(e) => setStoriesDjEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Show my DJ-tier Stories to DJs
        </label>
        <p className="mt-1.5 text-xs text-ink-3">
          Independent of DJ requests above — this only controls whether Stories you mark "DJs only" are visible to
          DJs.
        </p>
      </section>

      {saved ? <p className="text-sm text-support-400">Saved.</p> : null}
      <Button onClick={handleSave} loading={saving} className="w-fit">
        Save changes
      </Button>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Verification</h2>
        {artist.verified ? (
          <p className="text-sm text-support-400">Your artist profile is verified.</p>
        ) : verificationRequested ? (
          <p className="text-sm text-ink-2">Verification request submitted — an admin will review it.</p>
        ) : showVerificationForm ? (
          <div className="flex flex-col gap-2 rounded-xl border border-surface-border bg-surface-2 p-3">
            <Label>Why should this account be verified?</Label>
            <TextArea
              rows={3}
              value={verificationNote}
              onChange={(e) => setVerificationNote(e.target.value)}
              placeholder="e.g. links to your official socials/press, releases, why you're notable enough to verify — an admin has nothing else to go on."
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
          <Button size="sm" variant="secondary" onClick={() => setShowVerificationForm(true)}>
            Request verification
          </Button>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Membership</h2>
        <MembershipSection uid={artist.artistId} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Payout settings</h2>
        <div className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3 text-sm text-ink-1">
          Connect your Stripe payout account from the Revenue tab.
        </div>
      </section>

      <AccountSecuritySection />

      {hasRole('admin') ? (
        <section className="flex flex-col gap-2 rounded-xl border border-danger-500/20 bg-danger-500/[0.03] p-4">
          <p className="text-sm font-semibold text-ink-0">Step back from artist (admin only)</p>
          <p className="text-xs leading-5 text-ink-2">
            Hides your public artist profile and tracks from everyone — including on shared links — until you add the artist role back. Nothing is deleted. Only visible to admin accounts.
          </p>
          <Button variant="danger" size="sm" className="w-fit" loading={removingRole} onClick={handleRemoveArtistRole}>
            Remove artist role
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

function MembershipSection({ uid }: { uid: string }) {
  const [membership, setMembership] = useState<SubscriptionDoc | null | undefined>(undefined)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeToOwnSubscription(uid, setMembership, undefined, 'artist'), [uid])

  const isActive = membership?.status === 'active' || membership?.status === 'trialing'

  async function handleSubscribe() {
    setCheckoutLoading(true)
    setError(null)
    try {
      await subscribeToPlan('artist_membership', 'artist', '/dashboard/artist/settings')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
      setCheckoutLoading(false)
    }
  }

  if (membership === undefined) return <p className="text-sm text-ink-2">Checking membership status…</p>

  if (isActive) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-support-500/30 bg-support-500/5 px-4 py-3 text-sm">
        <span className="text-ink-1">
          {membership?.status === 'trialing' ? 'Artist Membership — free trial (£29.99/year after)' : 'Artist Membership — active (£29.99/year)'}
        </span>
        <Button variant="secondary" size="sm" onClick={openBillingPortal}>
          Manage billing
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-warning-500/25 bg-warning-500/[0.06] px-4 py-3 text-sm leading-6 text-ink-1">
      <p>
        {membership?.status === 'past_due'
          ? 'Your last Artist Membership payment failed — publishing is paused until it’s resolved.'
          : 'No active Artist Membership. Publishing new tracks requires membership — 14 days free, then £29.99/year.'}
      </p>
      {error ? <p className="mt-2 text-danger-500">{error}</p> : null}
      <Button className="mt-3" size="sm" loading={checkoutLoading} onClick={membership?.status === 'past_due' ? openBillingPortal : handleSubscribe}>
        {membership?.status === 'past_due' ? 'Update payment' : 'Start 14-day free trial'}
      </Button>
    </div>
  )
}
