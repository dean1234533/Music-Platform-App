import { useEffect, useState, type ReactNode } from 'react'
import { Eye, Headphones, Heart, MessageSquare, Play, Radio, Share2, UserPlus, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistProfile, subscribeArtistTracks } from '@/services/artistService'
import { subscribeRequestsForArtist } from '@/services/licenceService'
import { LoadingState } from '@/components/common/StateViews'
import { ShareButton } from '@/components/common/ShareButton'
import { formatCount } from '@/utils/format'
import { artistShareUrl, copyToClipboard, trackShareUrl } from '@/utils/shareLinks'
import { useToast } from '@/contexts/ToastContext'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'
import type { LicenceRequestDoc } from '@/types/licence'

export function GrowthPage() {
  const { firebaseUser } = useAuth()
  const { notify } = useToast()
  const [artist, setArtist] = useState<ArtistProfile | null>(null)
  const [tracks, setTracks] = useState<TrackDoc[]>([])
  const [djRequests, setDjRequests] = useState<LicenceRequestDoc[]>([])

  useEffect(() => {
    if (!firebaseUser) return
    const unsubProfile = subscribeArtistProfile(firebaseUser.uid, setArtist)
    const unsubTracks = subscribeArtistTracks(firebaseUser.uid, setTracks)
    const unsubRequests = subscribeRequestsForArtist(firebaseUser.uid, setDjRequests)
    return () => {
      unsubProfile()
      unsubTracks()
      unsubRequests()
    }
  }, [firebaseUser])

  if (!artist) return <LoadingState />

  const profileUrl = artistShareUrl(artist.slug)
  const totalTrackViews = tracks.reduce((sum, track) => sum + (track.viewCount ?? 0), 0)
  const totalSamplePlays = tracks.reduce((sum, track) => sum + track.playCount, 0)
  const totalFullPlays = tracks.reduce((sum, track) => sum + (track.fullPlayCount ?? 0), 0)
  const referralEntries = Object.entries(artist.referralViews ?? {}).sort(([, a], [, b]) => b - a)

  async function handleCopyProfile() {
    const ok = await copyToClipboard(profileUrl)
    if (ok) notify('Profile link copied.')
  }

  return (
    <div className="flex flex-col gap-7 pb-4">
      <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d1109] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,.28)] sm:px-8 sm:py-8">
        <div className="absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
          <Share2 className="h-3.5 w-3.5" /> Share &amp; growth
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Your public reach</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-white/60 sm:text-base">
          Real numbers from your public profile and track links — not estimates.
        </p>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur-md sm:flex-row sm:items-center sm:pr-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/45">Public profile</p>
            <p className="mt-0.5 truncate text-sm font-medium text-white">{profileUrl}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => void handleCopyProfile()}
              className="w-full rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.1] sm:w-auto"
            >
              Copy
            </button>
            <ShareButton
              url={profileUrl}
              title={artist.name}
              text={`Check out ${artist.name} on BackTheVibes`}
              className="w-full justify-center sm:w-auto"
            />
          </div>
        </div>
      </section>

      <section aria-label="Growth metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Eye className="h-5 w-5" />} label="Profile views" value={formatCount(artist.profileViews ?? 0)} accent="brand" />
        <StatCard icon={<Users className="h-5 w-5" />} label="Followers" value={formatCount(artist.followerCount)} accent="neutral" />
        <StatCard icon={<Headphones className="h-5 w-5" />} label="Preview plays" value={formatCount(totalSamplePlays)} accent="dj" />
        <StatCard icon={<Play className="h-5 w-5" />} label="Full-track plays" value={formatCount(totalFullPlays)} accent="brand" />
        <StatCard icon={<UserPlus className="h-5 w-5" />} label="Follow conversions" value={formatCount(artist.followConversions ?? 0)} accent="neutral" />
        <StatCard icon={<Heart className="h-5 w-5" />} label="Support conversions" value={formatCount(artist.supportConversions ?? 0)} accent="support" />
        <StatCard icon={<MessageSquare className="h-5 w-5" />} label="DJ requests received" value={formatCount(djRequests.length)} accent="support" />
      </section>
      <p className="-mt-4 text-xs text-ink-3">Follow/support conversions only count when the fan played a preview of yours in the 24 hours beforehand — a real signal, not every follow or support.</p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-surface-border bg-surface-1 shadow-[0_18px_55px_rgba(0,0,0,.16)]">
          <div className="border-b border-surface-border px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">Track links</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-0">Share individual tracks</h2>
          </div>

          {tracks.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-400/20 bg-brand-500/10 text-brand-400"><Radio className="h-6 w-6" /></div>
              <h3 className="mt-4 text-base font-semibold text-ink-0">Nothing to share yet</h3>
              <p className="mt-1 max-w-xs text-sm leading-6 text-ink-2">Upload a track and its shareable link will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {tracks.map((track) => {
                const url = trackShareUrl(artist.slug, track.trackSlug ?? track.trackId)
                return (
                  <div key={track.trackId} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-3">
                      {track.artworkURL ? <img src={track.artworkURL} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-0">{track.title}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-3">
                        {formatCount(track.viewCount ?? 0)} views · {formatCount(track.playCount)} sample plays
                      </p>
                    </div>
                    <ShareButton url={url} title={track.title} text={`Listen to "${track.title}" by ${artist.name} on BackTheVibes`} />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-surface-border bg-surface-1 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3">Where views come from</p>
            {referralEntries.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-ink-2">
                No tagged traffic yet. Links copied from a Share sheet count as direct — add <code className="rounded bg-surface-3 px-1 py-0.5 text-xs">?ref=name</code> to a link to track a specific source.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {referralEntries.map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-ink-1">{source}</span>
                    <span className="shrink-0 font-medium tabular-nums text-ink-0">{formatCount(count)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-support-500/20 bg-[linear-gradient(145deg,rgba(74,47,124,.28),rgba(16,17,19,.96)_65%)] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-support-400">Supporters</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-ink-0">{formatCount(artist.supporterCount)}</p>
            <p className="mt-1 text-sm text-ink-2">fans directing monthly support to you</p>
            <p className="mt-1 text-xs text-ink-3">{formatCount(totalTrackViews)} total track-page views across your catalogue</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent: 'brand' | 'support' | 'dj' | 'neutral' }) {
  const accentClasses = {
    brand: 'border-brand-400/20 bg-brand-500/10 text-brand-400',
    support: 'border-support-400/20 bg-support-500/10 text-support-400',
    dj: 'border-dj-400/20 bg-dj-500/10 text-dj-400',
    neutral: 'border-white/10 bg-white/[0.05] text-ink-1',
  }
  return (
    <div className="group rounded-2xl border border-surface-border bg-surface-1 p-4 shadow-[0_12px_35px_rgba(0,0,0,.12)] transition hover:-translate-y-0.5 hover:border-white/15 sm:p-5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${accentClasses[accent]}`}>{icon}</div>
      <p className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-ink-0 sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-medium text-ink-3 sm:text-sm">{label}</p>
    </div>
  )
}
