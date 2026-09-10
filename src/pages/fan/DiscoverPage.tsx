import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  listArtistsSeekingDJExposure,
  listMostSupportedArtists,
  listNewReleaseTracks,
  listRisingArtists,
} from '@/services/discoveryService'
import { getArtistProfile } from '@/services/artistService'
import { TrackCard } from '@/components/music/TrackCard'
import { ArtistCard } from '@/components/music/ArtistCard'
import { LoadingState, EmptyState } from '@/components/common/StateViews'
import type { ArtistProfile } from '@/types/artist'
import type { TrackDoc } from '@/types/track'

const DISPLAY_COUNT = 12
// Over-fetch so there's still a full section left after excluding artists an
// earlier section already claimed — without this, two overlapping top-N
// rankings could leave a later section thin even though enough distinct
// artists genuinely exist further down that same truthful ranking.
const FETCH_COUNT = 24

export function DiscoverPage() {
  const { firebaseUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [newReleases, setNewReleases] = useState<TrackDoc[]>([])
  const [risingArtists, setRisingArtists] = useState<ArtistProfile[]>([])
  const [risingEmptyReason, setRisingEmptyReason] = useState<'none' | 'claimed' | null>(null)
  const [mostSupported, setMostSupported] = useState<ArtistProfile[]>([])
  const [mostSupportedEmptyReason, setMostSupportedEmptyReason] = useState<'none' | 'claimed' | null>(null)
  const [djReadyArtists, setDjReadyArtists] = useState<ArtistProfile[]>([])
  const [djReadyEmptyReason, setDjReadyEmptyReason] = useState<'none' | 'claimed' | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [releases, rising, supported, djTracks] = await Promise.all([
        listNewReleaseTracks(24),
        listRisingArtists(FETCH_COUNT),
        listMostSupportedArtists(FETCH_COUNT),
        listArtistsSeekingDJExposure(FETCH_COUNT),
      ])
      if (cancelled) return

      // "Artists seeking DJ exposure" is artist-level, not track-level — a
      // track query is only how it's sourced (the visibility/embargo checks
      // live on tracks). Resolve to the tracks' unique artists via the same
      // single-document getArtistProfile() lookup TrackCard already uses,
      // never a list query, so it can't hit the get()-without-a-filter
      // list-query restriction (see onUserRolesChange's comment).
      const uniqueDjArtistIds = [...new Set(djTracks.map((track) => track.artistId))]
      const djArtistProfiles = (await Promise.all(uniqueDjArtistIds.map((id) => getArtistProfile(id)))).filter(
        (a): a is ArtistProfile => a !== null,
      )
      if (cancelled) return

      // Presentation-layer-only dedup: rankings themselves are untouched (each
      // list is still exactly what the query returned, in the query's own
      // order) — this only decides which already-ranked artist appears in
      // which section, by immutable artistId, never by name/slug. Rising
      // claims first, matching the order these sections read top-to-bottom.
      // The signed-in artist doesn't see themselves recommended when there's
      // a real alternative — but if excluding them would empty the section
      // out entirely (e.g. they're currently the only artist on the
      // platform), show it anyway: a blank "no artists" page is a worse,
      // more confusing experience than briefly seeing your own card.
      const selfId = firebaseUser?.uid
      const excludeSelfUnlessEmpty = (list: ArtistProfile[]) => {
        if (!selfId) return list
        const filtered = list.filter((artist) => artist.artistId !== selfId)
        return filtered.length > 0 ? filtered : list
      }
      const dedupedRising = excludeSelfUnlessEmpty(rising)
      const shown = new Set<string>(dedupedRising.map((artist) => artist.artistId))
      const supportedCandidates = excludeSelfUnlessEmpty(supported)
      const dedupedSupported = supportedCandidates.filter((artist) => !shown.has(artist.artistId))
      // "Artists seeking DJ exposure" doesn't compete with Rising/Most Supported for a
      // dedup slot — those two are both popularity rankings that can legitimately overlap
      // (the same artist genuinely ranking in both), which is what cross-section dedup was
      // built for. "Seeking DJ exposure" is a different kind of fact (this artist has a
      // track opted into DJ licensing), true independently of whether they also rank as
      // Rising or Most Supported — hiding it because they appeared above defeats the
      // section's purpose rather than avoiding a real duplicate.
      const dedupedDjArtists = excludeSelfUnlessEmpty(djArtistProfiles)

      setNewReleases(releases)
      setRisingEmptyReason(rising.length === 0 ? 'none' : dedupedRising.length === 0 ? 'claimed' : null)
      setRisingArtists(dedupedRising.slice(0, DISPLAY_COUNT))
      // Distinguish "no candidates at all" from "every candidate was already
      // claimed by an earlier section" (self-exclusion no longer causes this
      // — it only removes you when someone else remains) — each gets its own
      // honest copy.
      setMostSupportedEmptyReason(supported.length === 0 ? 'none' : dedupedSupported.length === 0 ? 'claimed' : null)
      setMostSupported(dedupedSupported.slice(0, DISPLAY_COUNT))
      setDjReadyEmptyReason(
        djArtistProfiles.length === 0 ? 'none' : dedupedDjArtists.length === 0 ? 'claimed' : null,
      )
      setDjReadyArtists(dedupedDjArtists.slice(0, DISPLAY_COUNT))
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [firebaseUser])

  if (loading) return <LoadingState label="Loading discovery…" />

  return (
    <div className="flex flex-col gap-12">
      <div className="border-b border-white/[0.08] pb-8 pt-2">
        <p className="eyebrow">Beyond the algorithm</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.045em] text-ink-0 sm:text-5xl">Find your next obsession.</h1>
        <p className="mt-3 text-base text-ink-2">Independent releases, real momentum, no fabricated charts.</p>
      </div>

      <TrackSection title="New releases" tracks={newReleases} />
      <ArtistSection
        title="Rising artists"
        artists={risingArtists}
        emptyLabel={
          risingEmptyReason === 'claimed'
            ? 'More artists will appear here as the BackTheVibes community grows.'
            : 'No artists have joined yet.'
        }
      />
      <ArtistSection
        title="Most supported artists"
        artists={mostSupported}
        emptyLabel={
          mostSupportedEmptyReason === 'claimed'
            ? 'More artists will appear here as the BackTheVibes community grows.'
            : 'No artists have paying supporters yet.'
        }
      />
      <ArtistSection
        title="Artists seeking DJ exposure"
        artists={djReadyArtists}
        emptyLabel={
          djReadyEmptyReason === 'claimed'
            ? 'More artists will appear here as the BackTheVibes community grows.'
            : 'No artists are currently open for DJ promotion.'
        }
      />
    </div>
  )
}

function TrackSection({ title, tracks, emptyLabel }: { title: string; tracks: TrackDoc[]; emptyLabel?: string }) {
  return (
    <div>
      <h2 className="mb-5 text-xl font-medium tracking-[-0.025em] text-ink-0">{title}</h2>
      {tracks.length === 0 ? (
        <EmptyState title={emptyLabel ?? 'Nothing here yet'} />
      ) : (
        <div className="scrollbar-none flex gap-5 overflow-x-auto pb-5">
          {tracks.map((track) => (
            <TrackCard key={track.trackId} track={track} queue={tracks} />
          ))}
        </div>
      )}
    </div>
  )
}

function ArtistSection({ title, artists, emptyLabel }: { title: string; artists: ArtistProfile[]; emptyLabel?: string }) {
  return (
    <div>
      <h2 className="mb-5 text-xl font-medium tracking-[-0.025em] text-ink-0">{title}</h2>
      {artists.length === 0 ? (
        <EmptyState title={emptyLabel ?? 'Nothing here yet'} />
      ) : (
        <div className="scrollbar-none flex gap-5 overflow-x-auto pb-5">
          {artists.map((artist) => (
            <ArtistCard key={artist.artistId} artist={artist} />
          ))}
        </div>
      )}
    </div>
  )
}
