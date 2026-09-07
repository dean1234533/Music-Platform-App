import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Disc3, MapPin, Radio, Sparkles } from 'lucide-react'
import { getArtistIdForSlug, subscribeArtistProfile, subscribePublicArtistTracks } from '@/services/artistService'
import { subscribePublicArtistPosts } from '@/services/artistPostService'
import { subscribeIsFollowing } from '@/services/followService'
import { subscribeIsSupporting } from '@/services/supportService'
import { useAuth } from '@/contexts/AuthContext'
import { FollowButton } from '@/components/music/FollowButton'
import { SupportButton } from '@/components/music/SupportButton'
import { TrackCard } from '@/components/music/TrackCard'
import { ErrorState, LoadingState } from '@/components/common/StateViews'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import { BrandMark } from '@/components/common/BrandMark'
import { ShareButton } from '@/components/common/ShareButton'
import { formatCount } from '@/utils/format'
import { artistShareUrl } from '@/utils/shareLinks'
import type { ArtistProfile, ArtistPost } from '@/types/artist'
import type { TrackDoc } from '@/types/track'

export function ArtistPublicProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const { firebaseUser } = useAuth()
  const [artistId, setArtistId] = useState<string | null | undefined>(undefined)
  const [artist, setArtist] = useState<ArtistProfile | null>(null)
  const [tracks, setTracks] = useState<TrackDoc[]>([])
  const [posts, setPosts] = useState<ArtistPost[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [isSupporting, setIsSupporting] = useState(false)

  useEffect(() => {
    if (!slug) return
    setArtistId(undefined)
    void getArtistIdForSlug(slug).then(setArtistId)
  }, [slug])

  useEffect(() => {
    if (!artistId) return
    const unsubProfile = subscribeArtistProfile(artistId, setArtist)
    const unsubTracks = subscribePublicArtistTracks(artistId, setTracks)
    return () => {
      unsubProfile()
      unsubTracks()
    }
  }, [artistId])

  useEffect(() => {
    if (!artistId || !firebaseUser) {
      setIsFollowing(false)
      setIsSupporting(false)
      return
    }
    const unsub1 = subscribeIsFollowing(firebaseUser.uid, artistId, setIsFollowing)
    const unsub2 = subscribeIsSupporting(firebaseUser.uid, artistId, setIsSupporting)
    return () => {
      unsub1()
      unsub2()
    }
  }, [artistId, firebaseUser])

  useEffect(() => {
    if (!artistId) return
    return subscribePublicArtistPosts(artistId, { isFollowing, isSupporting }, setPosts)
  }, [artistId, isFollowing, isSupporting])

  if (artistId === undefined) return <LoadingState label="Loading artist…" />
  if (artistId === null) return <ErrorState title="Artist not found" description="This artist URL doesn't exist." />
  if (!artist) return <LoadingState label="Loading artist…" />

  const publicTracks = tracks

  return (
    <div className="min-h-svh overflow-hidden bg-surface-0 pb-24 text-ink-0">
      <header className="relative z-30 mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" aria-label="Wavelength home"><BrandMark /></Link>
        <Link to="/app/discover" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink-1 transition hover:border-white/20 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Discover
        </Link>
      </header>

      <div className="relative h-64 w-full overflow-hidden border-y border-white/[0.06] bg-surface-2 sm:h-80 lg:h-[23rem]">
        {artist.coverURL ? (
          <img src={artist.coverURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_72%_20%,rgba(43,78,255,.38),transparent_28rem),linear-gradient(125deg,#0b0e12_0%,#11182b_58%,#07090b_100%)]">
            <div className="absolute -right-8 -top-20 select-none font-serif text-[20rem] leading-none text-white/[0.035] sm:text-[27rem]">{artist.name.charAt(0).toUpperCase()}</div>
            <div className="absolute left-[8%] top-1/2 h-px w-[52%] bg-gradient-to-r from-brand-400/60 to-transparent" />
            <div className="absolute left-[16%] top-[58%] h-px w-[38%] bg-gradient-to-r from-white/20 to-transparent" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-0 via-surface-0/10 to-transparent" />
      </div>

      <main className="relative z-10 mx-auto -mt-20 max-w-6xl px-5 sm:-mt-24 sm:px-8 lg:px-10">
        <section className="premium-panel rounded-[2rem] p-5 sm:p-7 lg:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[1.6rem] border border-white/15 bg-surface-3 shadow-[0_24px_70px_rgba(0,0,0,.45)] sm:h-36 sm:w-36">
            {artist.photoURL ? (
              <img src={artist.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(200,243,63,.22),transparent_42%),linear-gradient(145deg,#1c2430,#0b0e12)] font-serif text-5xl text-white sm:text-6xl">
                {artist.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-brand-400"><Radio className="h-3.5 w-3.5" /> Independent artist</p>
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-3xl font-medium tracking-[-0.045em] text-ink-0 sm:text-5xl">{artist.name}</h1>
              {artist.verified ? <BadgeCheck className="h-6 w-6 shrink-0 text-brand-400" /> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
              {artist.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {artist.location}
                </span>
              ) : null}
              <span><strong className="font-semibold text-ink-0">{formatCount(artist.followerCount)}</strong> followers</span>
              <span><strong className="font-semibold text-ink-0">{formatCount(artist.supporterCount)}</strong> supporters</span>
            </div>
            {artist.genres.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {artist.genres.map((genre) => (
                  <span key={genre} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-ink-1">
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2 self-stretch sm:self-auto">
            <FollowButton artistId={artist.artistId} />
            <SupportButton />
            <ShareButton
              url={artistShareUrl(artist.slug)}
              title={artist.name}
              text={`Check out ${artist.name} on Wavelength`}
            />
          </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,.7fr)]">
          <div>
            <div className="mb-4 flex items-end justify-between border-b border-white/[0.08] pb-4">
              <div><p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ink-3">Catalogue</p><h2 className="mt-1 text-2xl font-medium tracking-[-0.03em] text-ink-0">Tracks</h2></div>
              <span className="text-sm tabular-nums text-ink-3">{publicTracks.length.toString().padStart(2, '0')} releases</span>
            </div>
            {publicTracks.length === 0 ? (
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.015] px-7 py-12 sm:px-10 sm:py-16">
                <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-brand-500/[0.08] blur-3xl" />
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-brand-400/20 bg-brand-400/[0.08] text-brand-400"><Disc3 className="h-5 w-5" /></span>
                <h3 className="mt-7 text-2xl font-medium tracking-[-0.03em] text-ink-0">The first release is coming.</h3>
                <p className="mt-3 max-w-md text-base leading-7 text-ink-2">Follow {artist.name} and their next public track will appear in your feed as soon as it lands.</p>
                <div className="mt-7 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-400"><Sparkles className="h-3.5 w-3.5" /> Be here from the beginning</div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {publicTracks.map((track) => (
                  <TrackCard key={track.trackId} track={track} queue={publicTracks} />
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.025] p-6">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ink-3">About</p>
              <p className="mt-4 text-base leading-7 text-ink-1">{artist.bio || `${artist.name} is building their Wavelength profile. Follow along for new music and artist updates.`}</p>
            </div>
            <div className="rounded-[1.5rem] border border-brand-400/15 bg-brand-400/[0.055] p-6">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-brand-400">Direct support</p>
              <p className="mt-3 text-sm leading-6 text-ink-1">Support goes beyond a play. Help independent music keep moving.</p>
            </div>
          </aside>
        </div>

        {posts.length > 0 ? (
          <div className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-ink-0">Posts</h2>
            <div className="flex flex-col gap-3">
              {posts.map((post) => (
                <div key={post.postId} className="rounded-xl border border-surface-border bg-surface-1 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-ink-0">{post.title}</h3>
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink-2">
                      {post.visibility === 'everyone' ? 'Everyone' : post.visibility === 'followers' ? 'Followers' : 'Supporters'}
                    </span>
                  </div>
                  {post.body ? <p className="mt-2 text-sm text-ink-1">{post.body}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {firebaseUser && !isSupporting ? (
          <UpgradePrompt
            role="fan"
            reason={`Supporter-only posts and exclusive tracks from ${artist.name} are for supporters.`}
            cta="Become a Supporter"
            className="mt-10"
          />
        ) : null}
      </main>
    </div>
  )
}
