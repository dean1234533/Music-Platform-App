import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useSmartBack } from '@/hooks/useSmartBack'
import { ArrowLeft, BadgeCheck, Disc3, Flag, MapPin } from 'lucide-react'
import { subscribeDJProfile } from '@/services/djService'
import { useAuth } from '@/contexts/AuthContext'
import { BrandMark } from '@/components/common/BrandMark'
import { ErrorState, LoadingState } from '@/components/common/StateViews'
import { ReportUserModal } from '@/components/track/ReportUserModal'
import type { DJProfile } from '@/types/dj'

export function DJPublicProfilePage() {
  const { djId } = useParams<{ djId: string }>()
  const [searchParams] = useSearchParams()
  // Opened as a self-preview from DJ settings (target="_blank", so this tab's own history
  // never included Settings — useSmartBack's usual "no history" fallback of "/" would
  // otherwise send the DJ to the public homepage instead of back to what they were editing).
  const goBack = useSmartBack(searchParams.get('preview') === '1' ? '/dj/profile' : '/')
  const { firebaseUser } = useAuth()
  const [profile, setProfile] = useState<DJProfile | null | undefined>(undefined)
  const [loadError, setLoadError] = useState(false)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    if (!djId) return
    return subscribeDJProfile(djId, setProfile, (error) => {
      // The DJ stepped back from the dj role (removeRole) — the profile doc
      // still exists but reads now fail closed. Deliberately hidden, not an error.
      if ((error as { code?: string }).code === 'permission-denied') {
        setProfile(null)
      } else {
        setLoadError(true)
      }
    })
  }, [djId])

  if (profile === undefined && loadError) {
    return <ErrorState title="Something went wrong" description="Couldn't load this page. Try refreshing." />
  }
  if (profile === undefined) return <LoadingState label="Loading DJ…" />
  if (profile === null) return <ErrorState title="DJ not found" description="This DJ profile doesn't exist." />

  return (
    <div className="min-h-svh overflow-hidden bg-surface-0 pb-24 text-ink-0">
      <header className="relative z-30 mx-auto flex min-h-20 max-w-[1440px] items-center justify-between px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
        <Link to="/" aria-label="BackTheVibes home"><BrandMark /></Link>
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink-1 transition hover:border-white/20 hover:text-white active:opacity-60"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </header>

      <div className="relative h-60 w-full overflow-hidden border-y border-white/[0.06] bg-surface-2 sm:h-72 lg:h-96">
        <img
          src={profile.coverURL || '/dj-requests-empty-bg.png'}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,7,.08)_0%,rgba(5,6,7,.16)_42%,rgba(5,6,7,.76)_100%)]" />
      </div>

      <main className="relative z-10 mx-auto -mt-28 max-w-6xl px-5 sm:-mt-32 sm:px-8 lg:-mt-52 lg:px-10">
        <section className="premium-panel relative overflow-hidden rounded-[2rem] !bg-transparent p-5 backdrop-blur-md sm:p-7 lg:p-9">
          <img
            src={profile.coverURL || '/dj-requests-empty-bg.png'}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-75"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,7,.72),rgba(5,6,7,.38)_58%,rgba(5,6,7,.18)),linear-gradient(0deg,rgba(5,6,7,.44),transparent_72%)]" />
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[1.6rem] border border-dj-400/35 bg-surface-3 shadow-[0_24px_70px_rgba(0,0,0,.45)] sm:h-36 sm:w-36">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="" className="h-full w-full object-cover object-center" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,.24),transparent_42%),linear-gradient(145deg,#172333,#090c10)] font-serif text-5xl text-white sm:text-6xl">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-dj-400"><Disc3 className="h-3.5 w-3.5" /> DJ profile</p>
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-3xl font-medium tracking-[-0.045em] text-ink-0 sm:text-5xl">{profile.name}</h1>
              {profile.verificationStatus === 'verified' ? <BadgeCheck className="h-6 w-6 shrink-0 text-brand-400" /> : null}
            </div>
            {profile.city || profile.country ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-2">
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
          {firebaseUser ? (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              aria-label="Report this DJ"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-ink-3 transition hover:border-white/20 hover:text-ink-1"
            >
              <Flag className="h-4 w-4" />
            </button>
          ) : null}
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,.7fr)]">
          <section className="rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-7 sm:p-9">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-dj-400">About the DJ</p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-1">
              {profile.bio || `${profile.name} is building their BackTheVibes profile. Check back for their sound, story and latest sets.`}
            </p>
          </section>

          <aside className="rounded-[1.75rem] border border-dj-400/15 bg-dj-400/[0.045] p-7">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-dj-400">Played at</p>
            {profile.venues.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.venues.map((venue) => (
                  <span key={venue} className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-sm text-ink-1">
                    {venue}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-ink-2">Venue history will appear here as this profile grows.</p>
            )}
          </aside>
        </div>
      </main>
      {showReport ? <ReportUserModal userId={profile.djId} subjectLabel={profile.name} onClose={() => setShowReport(false)} /> : null}
    </div>
  )
}
