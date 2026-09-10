import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { completeOnboarding } from '@/services/userService'
import { createArtistProfile } from '@/services/artistService'
import { createDJProfile } from '@/services/djService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { EmptyState } from '@/components/common/StateViews'

/**
 * Adds the artist or DJ role to an account that already has at least one
 * role. Admin-only — a regular already-onboarded account can never add a
 * role to itself past its initial signup choice (firestore.rules freezes
 * its roles field from that point on), so this page just explains that
 * instead of presenting a form that would fail on submit.
 */
export function AddRolePage() {
  const { firebaseUser, profile, hasRole } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const role: 'artist' | 'dj' = params.get('role') === 'dj' ? 'dj' : 'artist'

  const [name, setName] = useState(profile?.displayName ?? '')
  const [bio, setBio] = useState('')
  const [genres, setGenres] = useState('')
  const [location, setLocation] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!firebaseUser || !profile) return
    setSaving(true)
    setError(null)
    try {
      const genreList = genres.split(',').map((g) => g.trim()).filter(Boolean)
      if (role === 'artist') {
        await createArtistProfile(firebaseUser.uid, { name, bio, genres: genreList, location })
      } else {
        await createDJProfile(firebaseUser.uid, { name, bio, genres: genreList, country: location, city })
      }
      const nextRoles = profile.roles.includes(role) ? profile.roles : [...profile.roles, role]
      await completeOnboarding(firebaseUser.uid, nextRoles)
      navigate(role === 'artist' ? '/dashboard/artist' : '/dj/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const canAddRole = hasRole('admin') || (profile?.roles.length ?? 0) === 0
  if (!canAddRole) {
    return (
      <EmptyState
        title="This isn't self-service"
        description="Adding another role to an account that's already onboarded needs an admin. Reach out and we'll sort it out."
        action={
          <Link to="/support" className="text-sm font-medium text-brand-400 hover:underline">
            Contact support →
          </Link>
        }
      />
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-10">
      <h1 className="text-xl font-semibold text-ink-0">
        {role === 'artist' ? 'Add your artist profile' : 'Add your DJ profile'}
      </h1>
      <div>
        <Label htmlFor="name">{role === 'artist' ? 'Artist name' : 'DJ name'}</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="bio">Bio</Label>
        <TextArea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="genres">Genres (comma separated)</Label>
        <Input id="genres" value={genres} onChange={(e) => setGenres(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="location">{role === 'artist' ? 'Location' : 'Country'}</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        {role === 'dj' ? (
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger-500">{error}</p> : null}
      <Button onClick={handleSubmit} loading={saving} disabled={!name} className="w-fit">
        Create profile
      </Button>
    </div>
  )
}
