import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Disc3, Flag, MapPin, Radio } from 'lucide-react'
import { ReportArtistModal } from '@/components/track/ReportArtistModal'
import { getArtistIdForSlug, subscribeArtistProfile, subscribePublicArtistTracks } from '@/services/artistService'
import { recordProfileView } from '@/services/analyticsService'
import { subscribePublicArtistPosts } from '@/services/artistPostService'
import { subscribeIsFollowing } from '@/services/followService'
import { subscribeIsSupporting } from '@/services/supportService'
import { useAuth } from '@/contexts/AuthContext'
import { FollowButton } from '@/components/music/FollowButton'
import { SupportButton } from '@/components/music/SupportButton'
import { TrackCard } from '@/components/music/TrackCard'
import { ErrorState, LoadingState } from '@/components/common/StateViews'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import { MusicGlyph } from '@/components/common/MusicGlyph'
import { BrandMark } from '@/components/common/BrandMark'
import { ShareButton } from '@/components/common/ShareButton'
import { StoryViewer, type StoryGroup } from '@/components/stories/StoryViewer'
import { subscribeActiveStoriesForArtist, subscribeArtistPublicHighlights } from '@/services/storyService'
import { formatCount } from '@/utils/format'
import { artistShareUrl } from '@/utils/shareLinks'
import type { ArtistProfile, ArtistPost } from '@/types/artist'
import type { TrackDoc } from '@/types/track'
import type { StoryDoc, StoryVisibility } from '@/types/story'
import { clsx } from 'clsx'
import { FanOfferCard } from '@/components/music/FanOfferCard'
import { claimFanOffer, removeFanOfferClaim, subscribeOwnFanOfferClaims, subscribeVisibleFanOffers } from '@/services/fanOfferService'
import { useToast } from '@/contexts/ToastContext'
import { describeTrackAccess } from '@/utils/trackAccess'
import type { FanOfferClaimDoc, FanOfferDoc } from '@/types/fanOffer'

export function ArtistPublicProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { firebaseUser, hasRole } = useAuth()
  const { notify } = useToast()
  const [artistId, setArtistId] = useState<string | null | undefined>(undefined)
  const [artist, setArtist] = useState<ArtistProfile | null>(null)
  const [tracks, setTracks] = useState<TrackDoc[]>([])
  const [posts, setPosts] = useState<ArtistPost[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [isSupporting, setIsSupporting] = useState(false)
  const [activeStoriesByTier, setActiveStoriesByTier] = useState<Record<string, StoryDoc[]>>({})
  const [highlights, setHighlights] = useState<StoryDoc[]>([])
  const [viewerGroup, setViewerGroup] = useState<StoryGroup | null>(null)
  const [fanOffers, setFanOffers] = useState<FanOfferDoc[]>([])
  const [offerClaims, setOfferClaims] = useState<FanOfferClaimDoc[]>([])
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    if (!slug) return
    setArtistId(undefined)
    void getArtistIdForSlug(slug).then(setArtistId)
  }, [slug])

  useEffect(() => {
    if (!artistId) return
    const unsubProfile = subscribeArtistProfile(artistId, setArtist, () => setLoadError(true))
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

  useEffect(() => {
    if (!artistId) return
    return subscribeVisibleFanOffers(artistId, { isFollowing, isSupporting }, setFanOffers)
  }, [artistId, isFollowing, isSupporting])

  useEffect(() => {
    if (!firebaseUser) {
      setOfferClaims([])
      return
    }
    return subscribeOwnFanOfferClaims(firebaseUser.uid, setOfferClaims)
  }, [firebaseUser])

  const qualifyingTiers = useMemo((): StoryVisibility[] => {
    const tiers: StoryVisibility[] = ['public']
    if (isFollowing) tiers.push('followers')
    if (isSupporting) tiers.push('supporters')
    if (hasRole('dj') && artist?.storiesDjEnabled) tiers.push('dj')
    return tiers
  }, [isFollowing, isSupporting, hasRole, artist?.storiesDjEnabled])

  useEffect(() => {
    if (!artistId) return
    const unsubs = qualifyingTiers.map((tier) =>
      subscribeActiveStoriesForArtist(artistId, tier, (stories) =>
        setActiveStoriesByTier((prev) => ({ ...prev, [tier]: stories })),
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [artistId, qualifyingTiers])

  useEffect(() => {
    if (!artistId) return
    return subscribeArtistPublicHighlights(artistId, setHighlights)
  }, [artistId])

  const hasRecordedView = useRef(false)
  useEffect(() => {
    if (!artistId || hasRecordedView.current) return
    hasRecordedView.current = true
    void recordProfileView(artistId, searchParams.get('ref'))
  }, [artistId, searchParams])

  // An old slug still resolves (getArtistIdForSlug follows the redirect),
  // but the address bar should settle on the current canonical one.
  useEffect(() => {
    if (!artist || !slug || artist.slug === slug) return
    navigate(`/artist/${artist.slug}${window.location.search}`, { replace: true })
  }, [artist, slug, navigate])

  if (artistId === undefined) return <LoadingState label="Loading artist…" />
  if (artistId === null) return <ErrorState title="Artist not found" description="This artist URL doesn't exist." />
  if (loadError) return <ErrorState title="Something went wrong" description="Couldn't load this page. Try refreshing." />
  if (!artist) return <LoadingState label="Loading artist…" />

  const publicTracks = tracks
  const hasLockedTracks = publicTracks.some(
    (track) => !describeTrackAccess(track, { isOwner: firebaseUser?.uid === artist.artistId, isAdmin: hasRole('admin'), isFollowing, isSupporting }).fullAccess,
  )
  const activeStories = Object.values(activeStoriesByTier)
    .flat()
    .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))
  const claimedOfferIds = new Set(offerClaims.map((claim) => claim.offerId))

  async function toggleOfferClaim(offer: FanOfferDoc) {
    if (!firebaseUser) {
      notify('Sign in to claim artist offers.', 'info')
      navigate('/sign-in')
      return
    }
    setPendingOfferId(offer.offerId)
    try {
      if (claimedOfferIds.has(offer.offerId)) {
        await removeFanOfferClaim(firebaseUser.uid, offer.offerId)
        notify(`Removed your claim for “${offer.title}”.`, 'info')
      } else {
        await claimFanOffer(firebaseUser.uid, offer)
        notify(`Claimed “${offer.title}”. Redemption details are now unlocked.`)
      }
    } catch {
      notify('Could not update this offer. Please try again.', 'error')
    } finally {
      setPendingOfferId(null)
    }
  }

  return (
    <div className="min-h-svh overflow-hidden bg-surface-0 pb-24 text-ink-0">
      <header className="relative z-30 mx-auto flex min-h-20 max-w-[1440px] items-center justify-between px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
        <Link to="/" aria-label="BackTheVibes home"><BrandMark /></Link>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink-1 transition hover:border-white/20 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </header>

      <div className="relative h-44 w-full overflow-hidden border-y border-white/[0.06] bg-surface-2 sm:h-52 lg:h-56">
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

      <main className="relative z-10 mx-auto -mt-12 max-w-6xl px-5 sm:-mt-14 sm:px-8 lg:-mt-16 lg:px-10">
        <section className="premium-panel rounded-[2rem] p-5 sm:p-7 lg:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <button
            type="button"
            onClick={() => activeStories.length > 0 && setViewerGroup({ artistId: artist.artistId, stories: activeStories })}
            className={clsx(
              'h-28 w-28 shrink-0 overflow-hidden rounded-[1.6rem] border shadow-[0_24px_70px_rgba(0,0,0,.45)] sm:h-36 sm:w-36',
              activeStories.length > 0 ? 'border-brand-400 border-2 cursor-pointer' : 'border-white/15 bg-surface-3',
            )}
          >
            {artist.photoURL ? (
              <img src={artist.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(200,243,63,.22),transparent_42%),linear-gradient(145deg,#1c2430,#0b0e12)] font-serif text-5xl text-white sm:text-6xl">
                {artist.name.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
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
          <div className="flex min-w-0 flex-wrap gap-2 self-stretch sm:w-auto sm:shrink-0 sm:self-auto">
            <FollowButton artistId={artist.artistId} />
            {!firebaseUser || !hasRole('dj') || hasRole('fan') ? <SupportButton artistId={artist.artistId} /> : null}
            <ShareButton
              url={artistShareUrl(artist.slug)}
              title={artist.name}
              text={`Check out ${artist.name} on BackTheVibes`}
            />
            {firebaseUser ? (
              <button
                type="button"
                onClick={() => setShowReport(true)}
                aria-label="Report this artist profile"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-ink-3 transition hover:border-white/20 hover:text-ink-1"
              >
                <Flag className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          </div>
        </section>

        {highlights.length > 0 ? (
          <div className="scrollbar-none mt-6 flex gap-4 overflow-x-auto pb-1">
            {highlights.map((h) => (
              <button
                key={h.storyId}
                onClick={() => setViewerGroup({ artistId: artist.artistId, stories: [h] })}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-white/15 bg-surface-2">
                  {h.mediaUrl && h.mediaKind === 'image' ? (
                    <img src={h.mediaUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-ink-2">✦</div>
                  )}
                </div>
                <span className="w-full truncate text-center text-xs text-ink-2">{h.highlightGroup || h.storyCategory}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,.7fr)]">
          <div>
            <div className="mb-4 flex items-end justify-between border-b border-white/[0.08] pb-4">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ink-3">Catalogue</p>
                <h2 className="mt-1 text-2xl font-medium tracking-[-0.03em] text-ink-0">Tracks</h2>
                {hasLockedTracks ? <p className="mt-1 text-xs text-ink-3">Follow to unlock full tracks — supporter-only releases unlock with support.</p> : null}
              </div>
              <span className="text-sm tabular-nums text-ink-3">{publicTracks.length.toString().padStart(2, '0')} releases</span>
            </div>
            {publicTracks.length === 0 ? (
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.015] px-7 py-12 sm:px-10 sm:py-16">
                <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-brand-500/[0.08] blur-3xl" />
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-brand-400/20 bg-brand-400/[0.08] text-brand-400"><Disc3 className="h-5 w-5" /></span>
                <h3 className="mt-7 text-2xl font-medium tracking-[-0.03em] text-ink-0">The first release is coming.</h3>
                <p className="mt-3 max-w-md text-base leading-7 text-ink-2">Follow {artist.name} and their next public track will appear in your feed as soon as it lands.</p>
                <div className="mt-7 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-400"><MusicGlyph className="h-4 w-4" /> Be here from the beginning</div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {publicTracks.map((track) => (
                  <TrackCard
                    key={track.trackId}
                    track={track}
                    queue={publicTracks}
                    locked={
                      !describeTrackAccess(track, {
                        isOwner: firebaseUser?.uid === artist.artistId,
                        isAdmin: hasRole('admin'),
                        isFollowing,
                        isSupporting,
                      }).fullAccess
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.025] p-6">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ink-3">About</p>
              <p className="mt-4 text-base leading-7 text-ink-1">{artist.bio || `${artist.name} is building their BackTheVibes profile. Follow along for new music and artist updates.`}</p>
            </div>
            <div className="rounded-[1.5rem] border border-brand-400/15 bg-brand-400/[0.055] p-6">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-brand-400">Direct support</p>
              <p className="mt-3 text-sm leading-6 text-ink-1">Support goes beyond a play. Help independent music keep moving.</p>
            </div>
          </aside>
        </div>

        {fanOffers.length > 0 ? (
          <section className="mt-10">
            <div className="mb-4 border-b border-white/[0.08] pb-4">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-brand-400">For the community</p>
              <h2 className="mt-1 text-2xl font-medium tracking-[-0.03em] text-ink-0">Offers from {artist.name}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fanOffers.map((offer) => (
                <FanOfferCard
                  key={offer.offerId}
                  offer={offer}
                  claimed={claimedOfferIds.has(offer.offerId)}
                  pending={pendingOfferId === offer.offerId}
                  onClaim={() => void toggleOfferClaim(offer)}
                />
              ))}
            </div>
          </section>
        ) : null}

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

        {firebaseUser && !isSupporting && (!hasRole('dj') || hasRole('fan')) ? (
          <UpgradePrompt
            role="fan"
            reason={`Supporter-only posts and exclusive tracks from ${artist.name} are for supporters.`}
            cta="Become a Supporter"
            className="mt-10"
          />
        ) : null}
      </main>

      {viewerGroup ? (
        <StoryViewer
          groups={[viewerGroup]}
          initialArtistId={viewerGroup.artistId}
          viewerUserId={firebaseUser?.uid ?? null}
          onClose={() => setViewerGroup(null)}
        />
      ) : null}
      {showReport ? <ReportArtistModal artistId={artist.artistId} onClose={() => setShowReport(false)} /> : null}
    </div>
  )
}
