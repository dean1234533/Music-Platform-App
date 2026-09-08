import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, MapPin } from 'lucide-react'
import { subscribeDJProfile } from '@/services/djService'
import { BrandMark } from '@/components/common/BrandMark'
import { ErrorState, LoadingState } from '@/components/common/StateViews'
import type { DJProfile } from '@/types/dj'

export function DJPublicProfilePage() {
  const { djId } = useParams<{ djId: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<DJProfile | null | undefined>(undefined)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!djId) return
    return subscribeDJProfile(djId, setProfile, () => setLoadError(true))
  }, [djId])

  if (profile === undefined && loadError) {
    return <ErrorState title="Something went wrong" description="Couldn't load this page. Try refreshing." />
  }
  if (profile === undefined) return <LoadingState label="Loading DJ…" />
  if (profile === null) return <ErrorState title="DJ not found" description="This DJ profile doesn't exist." />

  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6 sm:px-8">
        <Link to="/" aria-label="BackTheVibes home"><BrandMark /></Link>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 pb-24 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[1.6rem] border border-white/15 bg-surface-3 sm:h-36 sm:w-36">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-serif text-5xl text-ink-2">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-dj-400">DJ</p>
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-3xl font-semibold text-ink-0 sm:text-4xl">{profile.name}</h1>
              {profile.verificationStatus === 'verified' ? <BadgeCheck className="h-6 w-6 shrink-0 text-brand-400" /> : null}
            </div>
            {profile.city || profile.country ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
                <MapPin className="h-3.5 w-3.5" />
                {[profile.city, profile.country].filter(Boolean).join(', ')}
              </p>
            ) : null}
            {profile.genres.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.genres.map((genre) => (
                  <span key={genre} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-ink-1">
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {profile.bio ? <p className="text-base leading-7 text-ink-1">{profile.bio}</p> : null}

        {profile.venues.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Has played</p>
            <p className="mt-1 text-sm text-ink-1">{profile.venues.join(', ')}</p>
          </div>
        ) : null}
      </main>
    </div>
  )
}
