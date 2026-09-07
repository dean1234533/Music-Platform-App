import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BadgeCheck, MapPin } from 'lucide-react'
import { getArtistIdForSlug, subscribeArtistProfile, subscribePublicArtistTracks } from '@/services/artistService'
import { subscribePublicArtistPosts } from '@/services/artistPostService'
import { subscribeIsFollowing } from '@/services/followService'
import { subscribeIsSupporting } from '@/services/supportService'
import { useAuth } from '@/contexts/AuthContext'
import { FollowButton } from '@/components/music/FollowButton'
import { SupportButton } from '@/components/music/SupportButton'
import { TrackCard } from '@/components/music/TrackCard'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import { formatCount } from '@/utils/format'
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
    <div className="min-h-svh bg-surface-0 pb-24">
      <div className="relative h-56 w-full overflow-hidden bg-surface-2 sm:h-72">
        {artist.coverURL ? (
          <img src={artist.coverURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="gradient-glow h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-0 via-surface-0/20 to-transparent" />
      </div>

      <div className="mx-auto -mt-16 max-w-5xl px-4 sm:-mt-20 sm:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-surface-0 bg-surface-3 shadow-xl sm:h-36 sm:w-36">
            {artist.photoURL ? (
              <img src={artist.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-ink-1">
                {artist.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-semibold text-ink-0 sm:text-3xl">{artist.name}</h1>
              {artist.verified ? <BadgeCheck className="h-5 w-5 text-brand-400" /> : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-ink-2 sm:justify-start">
              {artist.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {artist.location}
                </span>
              ) : null}
              <span>{formatCount(artist.followerCount)} followers</span>
              <span>{formatCount(artist.supporterCount)} supporters</span>
            </div>
            {artist.genres.length > 0 ? (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {artist.genres.map((genre) => (
                  <span key={genre} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-1">
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <FollowButton artistId={artist.artistId} />
            <SupportButton />
          </div>
        </div>

        {artist.bio ? <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-1">{artist.bio}</p> : null}

        <div className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-ink-0">Tracks</h2>
          {publicTracks.length === 0 ? (
            <EmptyState title="No public tracks yet" description="This artist hasn't released anything publicly yet." />
          ) : (
            <div className="flex flex-wrap gap-4">
              {publicTracks.map((track) => (
                <TrackCard key={track.trackId} track={track} queue={publicTracks} />
              ))}
            </div>
          )}
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
      </div>
    </div>
  )
}
