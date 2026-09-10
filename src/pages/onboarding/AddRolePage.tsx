import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createArtistProfile } from '@/services/artistService'
import { createDJProfile } from '@/services/djService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'

/**
 * Adds the artist or DJ role to an account that already has at least one
 * role — legitimate self-service, e.g. a fan becoming an artist too. The
 * client only ever requests a specific named action ("create my artist
 * profile" / "create my DJ profile"); the createArtistProfile/
 * createDJProfile Cloud Functions decide the resulting role and grant it
 * server-side for request.auth.uid, never from anything this page sends.
 * firestore.rules' users/{userId} update rule blocks a direct client write
 * to roles after initial signup, so this callable path is the only way an
 * already-onboarded account can gain another role — by design, nothing
 * here lets the caller name an arbitrary role like "admin".
 */
export function AddRolePage() {
  const { firebaseUser, profile } = useAuth()
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
    if (!firebaseUser) return
    setSaving(true)
    setError(null)
    try {
      const genreList = genres.split(',').map((g) => g.trim()).filter(Boolean)
      if (role === 'artist') {
        await createArtistProfile({ name, bio, genres: genreList, location })
      } else {
        await createDJProfile({ name, bio, genres: genreList, country: location, city })
      }
      // users/{uid}.roles is updated by the Cloud Function via the Admin
      // SDK — AuthContext's own onSnapshot listener on that doc picks the
      // change up in real time, so no client-side role write happens here.
      navigate(role === 'artist' ? '/dashboard/artist' : '/dj/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
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
