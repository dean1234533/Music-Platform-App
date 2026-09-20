import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Disc3, PersonStanding } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { completeOnboarding } from '@/services/userService'
import { createArtistProfile } from '@/services/artistService'
import { createDJProfile } from '@/services/djService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import type { ArtistCreatorType } from '@/types/artist'

/** Lets an existing account add the artist or DJ role later, per the multi-role requirement. */
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
  const [creatorType, setCreatorType] = useState<ArtistCreatorType>('musician')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!firebaseUser || !profile) return
    setSaving(true)
    setError(null)
    try {
      const genreList = genres.split(',').map((g) => g.trim()).filter(Boolean)
      if (role === 'artist') {
        await createArtistProfile(firebaseUser.uid, { name, bio, genres: genreList, location, creatorType })
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

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-10">
      <h1 className="text-xl font-semibold text-ink-0">
        {role === 'artist' ? 'Add your artist profile' : 'Add your DJ profile'}
      </h1>
      {role === 'artist' ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCreatorType('musician')}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
              creatorType === 'musician' ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border bg-surface-2 hover:bg-surface-3'
            }`}
          >
            <Disc3 className={`h-4 w-4 shrink-0 ${creatorType === 'musician' ? 'text-brand-400' : 'text-ink-2'}`} />
            <span className="text-sm font-medium text-ink-0">Musician</span>
          </button>
          <button
            type="button"
            onClick={() => setCreatorType('dancer')}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
              creatorType === 'dancer' ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border bg-surface-2 hover:bg-surface-3'
            }`}
          >
            <PersonStanding className={`h-4 w-4 shrink-0 ${creatorType === 'dancer' ? 'text-brand-400' : 'text-ink-2'}`} />
            <span className="text-sm font-medium text-ink-0">Dancer</span>
          </button>
        </div>
      ) : null}
      <div>
        <Label htmlFor="name">
          {role === 'dj' ? 'DJ name' : creatorType === 'musician' ? 'Artist name' : 'Dancer name'}
        </Label>
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
