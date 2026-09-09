import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, AudioWaveform, Disc3, Eye, Headphones, Heart, Megaphone, Radio, UploadCloud, Users, Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistProfile, subscribeArtistTracks } from '@/services/artistService'
import { MusicGlyph } from '@/components/common/MusicGlyph'
import { LoadingState } from '@/components/common/StateViews'
import { formatCount } from '@/utils/format'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'

export function OverviewPage() {
  const { firebaseUser } = useAuth()
  const [artist, setArtist] = useState<ArtistProfile | null>(null)
  const [tracks, setTracks] = useState<TrackDoc[]>([])

  useEffect(() => {
    if (!firebaseUser) return
    const unsubProfile = subscribeArtistProfile(firebaseUser.uid, setArtist)
    const unsubTracks = subscribeArtistTracks(firebaseUser.uid, setTracks)
    return () => {
      unsubProfile()
      unsubTracks()
    }
  }, [firebaseUser])

  if (!artist) return <LoadingState />

  const totalPreviewPlays = tracks.reduce((sum, track) => sum + track.playCount, 0)
  const topTracks = [...tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 5)
  const maxPlays = Math.max(...topTracks.map((track) => track.playCount), 1)
  const supporterShare = artist.followerCount > 0
    ? Math.min(Math.round((artist.supporterCount / artist.followerCount) * 100), 100)
    : 0

  return (
    <div className="flex flex-col gap-7 pb-4">
      <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d1109] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,.28)] sm:px-8 sm:py-8">
        <img
              src={artist.coverURL || '/artist-command-centre-bg.png?v=20260909'}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[68%_center] opacity-[0.68]"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(7,9,5,.99)_10%,rgba(7,9,5,.88)_46%,rgba(7,9,5,.42)_78%,rgba(7,9,5,.2))]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-brand-400/35 to-transparent" />
        <div className="absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />

        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-brand-400/30 bg-brand-500/10">
                <AudioWaveform className="h-3.5 w-3.5" />
              </span>
              Artist command centre
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Welcome back, {artist.name}</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/60 sm:text-base">Your audience, releases and opportunities—together in one clear view.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/dashboard/artist/upload" className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-[#080a05] transition hover:bg-brand-400">
                <UploadCloud className="h-4 w-4" /> Upload music
              </Link>
              <Link to={`/artist/${artist.slug}`} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.1]">
                <Eye className="h-4 w-4" /> View public profile
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 pr-5 backdrop-blur-md">
            <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/10">
              {artist.photoURL ? <img src={artist.photoURL} alt="" className="h-full w-full object-cover" /> : <MusicGlyph className="m-3 h-6 w-6 text-brand-400" />}
            </div>
            <div>
              <p className="text-xs text-white/45">Public address</p>
              <p className="mt-0.5 text-sm font-medium text-white">/{artist.slug}</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Artist performance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Followers" value={formatCount(artist.followerCount)} accent="brand" />
        <StatCard icon={<Heart className="h-5 w-5" />} label="Supporters" value={formatCount(artist.supporterCount)} accent="support" />
        <StatCard icon={<Disc3 className="h-5 w-5" />} label="Live catalogue" value={formatCount(tracks.length)} accent="neutral" />
        <StatCard icon={<Headphones className="h-5 w-5" />} label="Preview plays" value={formatCount(totalPreviewPlays)} accent="dj" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-surface-border bg-surface-1 shadow-[0_18px_55px_rgba(0,0,0,.16)]">
          <div className="flex items-end justify-between gap-4 border-b border-surface-border px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">Catalogue pulse</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-0">Most played tracks</h2>
            </div>
            <Link to="/dashboard/artist/music" className="flex shrink-0 items-center gap-1 text-sm font-medium text-ink-2 transition hover:text-brand-400">Manage music <ArrowUpRight className="h-4 w-4" /></Link>
          </div>

          {topTracks.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-400/20 bg-[radial-gradient(circle_at_30%_20%,rgba(200,243,63,.18),rgba(200,243,63,.04))] text-brand-400 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"><MusicGlyph className="h-7 w-7" /></div>
              <h3 className="mt-4 text-base font-semibold text-ink-0">Your first release starts here</h3>
              <p className="mt-1 max-w-xs text-sm leading-6 text-ink-2">Upload a track to begin building your catalogue and tracking listener activity.</p>
              <Link to="/dashboard/artist/upload" className="mt-4 text-sm font-semibold text-brand-400 hover:text-brand-300">Upload a track →</Link>
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {topTracks.map((track, index) => (
                <div key={track.trackId} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.025] sm:px-6">
                  <span className="w-5 text-center text-xs font-semibold tabular-nums text-ink-3">{String(index + 1).padStart(2, '0')}</span>
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-3">
                    {track.artworkURL ? <img src={track.artworkURL} alt={`${track.title} artwork`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <Disc3 className="m-3 h-6 w-6 text-ink-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-0">{track.title}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-3">{track.genre || 'Independent release'}</p>
                      </div>
                      <p className="shrink-0 text-sm font-medium tabular-nums text-ink-1">{formatCount(track.playCount)} <span className="text-xs font-normal text-ink-3">plays</span></p>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${Math.max((track.playCount / maxPlays) * 100, 3)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section className="relative overflow-hidden rounded-2xl border border-support-500/20 bg-[linear-gradient(145deg,rgba(74,47,124,.28),rgba(16,17,19,.96)_65%)] p-5 shadow-[0_18px_55px_rgba(0,0,0,.16)] sm:p-6">
            <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-support-500/15 blur-3xl" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-support-400">Audience mix</p>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold tracking-[-0.04em] text-ink-0">{supporterShare}%</p>
                <p className="mt-1 text-sm text-ink-2">of your followers currently support you directly</p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-support-400/20 bg-support-500/10 text-support-400"><Heart className="h-6 w-6" /></div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-support-500 to-support-300" style={{ width: `${supporterShare}%` }} /></div>
            <Link to="/dashboard/artist/community" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-support-400 hover:text-support-300">Open community <ArrowUpRight className="h-4 w-4" /></Link>
          </section>

          <section className="rounded-2xl border border-surface-border bg-surface-1 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-3">Quick moves</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <QuickLink to="/dashboard/artist/stories" icon={<Radio className="h-4 w-4" />} label="Post a story" />
              <QuickLink to="/dashboard/artist/offers" icon={<Megaphone className="h-4 w-4" />} label="Create an offer" />
              <QuickLink to="/dashboard/artist/deals" icon={<Disc3 className="h-4 w-4" />} label="DJ deals" />
              <QuickLink to="/dashboard/artist/revenue" icon={<Wallet className="h-4 w-4" />} label="View revenue" />
            </div>
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

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="group flex min-h-24 flex-col justify-between rounded-xl border border-surface-border bg-surface-2 p-3.5 transition hover:border-brand-400/25 hover:bg-brand-500/[0.06]">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-ink-2 transition group-hover:bg-brand-500/10 group-hover:text-brand-400">{icon}</span>
      <span className="flex items-end justify-between gap-2 text-sm font-medium text-ink-1 group-hover:text-ink-0">{label} <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-3 transition group-hover:text-brand-400" /></span>
    </Link>
  )
}
