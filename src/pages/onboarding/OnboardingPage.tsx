import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Disc3, Headphones, Radio } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { completeOnboarding } from '@/services/userService'
import { createArtistProfile } from '@/services/artistService'
import { createDJProfile } from '@/services/djService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import type { UserRole } from '@/types/user'

const ROLE_OPTIONS: { role: UserRole; title: string; description: string; icon: typeof Headphones }[] = [
  { role: 'fan', title: 'Listen to music', description: 'Discover and follow independent artists.', icon: Headphones },
  { role: 'artist', title: 'Release music', description: 'Upload tracks and build recurring income.', icon: Disc3 },
  { role: 'dj', title: 'Use music professionally as a DJ', description: 'Discover, request, and licence tracks.', icon: Radio },
]

type Step = 'roles' | 'artist' | 'dj' | 'saving'

export function OnboardingPage() {
  const { firebaseUser, profile } = useAuth()
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [step, setStep] = useState<Step>('roles')
  const [error, setError] = useState<string | null>(null)

  const [artistForm, setArtistForm] = useState({ name: profile?.displayName ?? '', bio: '', genres: '', location: '' })
  const [djForm, setDjForm] = useState({ name: profile?.displayName ?? '', bio: '', genres: '', country: '', city: '' })

  async function handleRolesContinue() {
    if (!selectedRole) {
      setError('Select one option to continue.')
      return
    }
    setError(null)
    if (selectedRole === 'artist') setStep('artist')
    else if (selectedRole === 'dj') setStep('dj')
    else await finish()
  }

  async function finish() {
    if (!firebaseUser || !selectedRole) return
    setStep('saving')
    setError(null)
    try {
      await completeOnboarding(firebaseUser.uid, [selectedRole])

      if (selectedRole === 'artist') {
        await createArtistProfile(firebaseUser.uid, {
          name: artistForm.name || firebaseUser.displayName || 'Untitled Artist',
          bio: artistForm.bio,
          genres: artistForm.genres.split(',').map((g) => g.trim()).filter(Boolean),
          location: artistForm.location,
        })
      }

      if (selectedRole === 'dj') {
        await createDJProfile(firebaseUser.uid, {
          name: djForm.name || firebaseUser.displayName || 'Untitled DJ',
          bio: djForm.bio,
          genres: djForm.genres.split(',').map((g) => g.trim()).filter(Boolean),
          country: djForm.country,
          city: djForm.city,
        })
      }

      if (selectedRole === 'artist') {
        navigate('/dashboard/artist')
      } else if (selectedRole === 'dj') {
        navigate('/dj/discover')
      } else {
        navigate('/app/home')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong finishing setup.')
      setStep(selectedRole === 'artist' ? 'artist' : selectedRole === 'dj' ? 'dj' : 'roles')
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-0 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-1 p-6 sm:p-8">
        {step === 'roles' ? (
          <>
            <h1 className="text-xl font-semibold text-ink-0">What do you want to do?</h1>
            <p className="mt-1 text-sm text-ink-2">Choose one to start — you can add more later from Settings.</p>
            <div className="mt-6 flex flex-col gap-3">
              {ROLE_OPTIONS.map((option) => {
                const selected = selectedRole === option.role
                return (
                  <button
                    key={option.role}
                    type="button"
                    onClick={() => setSelectedRole(option.role)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                      selected ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border bg-surface-2 hover:bg-surface-3'
                    }`}
                  >
                    <option.icon className={`h-5 w-5 shrink-0 ${selected ? 'text-brand-400' : 'text-ink-2'}`} />
                    <span>
                      <span className="block text-sm font-medium text-ink-0">{option.title}</span>
                      <span className="block text-xs text-ink-2">{option.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {error ? <p className="mt-4 text-sm text-danger-500">{error}</p> : null}
            <Button className="mt-6 w-full" onClick={handleRolesContinue}>
              Continue
            </Button>
          </>
        ) : null}

        {step === 'artist' ? (
          <>
            <h1 className="text-xl font-semibold text-ink-0">Set up your artist profile</h1>
            <p className="mt-1 text-sm text-ink-2">You can refine everything later from your dashboard.</p>
            <div className="mt-6 flex flex-col gap-4">
              <div>
                <Label htmlFor="artist-name">Artist name</Label>
                <Input
                  id="artist-name"
                  value={artistForm.name}
                  onChange={(e) => setArtistForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="artist-bio">Biography</Label>
                <TextArea
                  id="artist-bio"
                  rows={3}
                  value={artistForm.bio}
                  onChange={(e) => setArtistForm((f) => ({ ...f, bio: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="artist-genres">Genres (comma separated)</Label>
                <Input
                  id="artist-genres"
                  placeholder="Indie, Electronic"
                  value={artistForm.genres}
                  onChange={(e) => setArtistForm((f) => ({ ...f, genres: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="artist-location">Location</Label>
                <Input
                  id="artist-location"
                  placeholder="London, UK"
                  value={artistForm.location}
                  onChange={(e) => setArtistForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
            </div>
            {error ? <p className="mt-4 text-sm text-danger-500">{error}</p> : null}
            <Button className="mt-6 w-full" onClick={() => void finish()} disabled={!artistForm.name}>
              Finish
            </Button>
          </>
        ) : null}

        {step === 'dj' ? (
          <>
            <h1 className="text-xl font-semibold text-ink-0">Set up your DJ profile</h1>
            <p className="mt-1 text-sm text-ink-2">
              Verification badges are only shown once an admin approves your account.
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <div>
                <Label htmlFor="dj-name">DJ name</Label>
                <Input id="dj-name" value={djForm.name} onChange={(e) => setDjForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="dj-bio">Bio</Label>
                <TextArea id="dj-bio" rows={3} value={djForm.bio} onChange={(e) => setDjForm((f) => ({ ...f, bio: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="dj-genres">Genres (comma separated)</Label>
                <Input
                  id="dj-genres"
                  placeholder="House, Techno"
                  value={djForm.genres}
                  onChange={(e) => setDjForm((f) => ({ ...f, genres: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dj-country">Country</Label>
                  <Input id="dj-country" value={djForm.country} onChange={(e) => setDjForm((f) => ({ ...f, country: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="dj-city">City</Label>
                  <Input id="dj-city" value={djForm.city} onChange={(e) => setDjForm((f) => ({ ...f, city: e.target.value }))} />
                </div>
              </div>
            </div>
            {error ? <p className="mt-4 text-sm text-danger-500">{error}</p> : null}
            <Button className="mt-6 w-full" onClick={() => void finish()} disabled={!djForm.name}>
              Finish
            </Button>
          </>
        ) : null}

        {step === 'saving' ? <p className="text-center text-sm text-ink-2">Setting up your account…</p> : null}
      </div>
    </div>
  )
}
