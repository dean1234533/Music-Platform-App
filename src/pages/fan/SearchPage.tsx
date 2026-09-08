import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, BadgeCheck } from 'lucide-react'
import { Input } from '@/components/common/Input'
import { searchPlatform } from '@/services/searchService'
import { TrackCard } from '@/components/music/TrackCard'
import { ArtistCard } from '@/components/music/ArtistCard'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { SearchResults } from '@/services/searchService'

export function SearchPage() {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!term.trim()) {
      setResults(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const timeout = setTimeout(() => {
      void searchPlatform(term).then((res) => {
        if (!cancelled) {
          setResults(res)
          setLoading(false)
        }
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [term])

  const hasResults = results && (results.artists.length > 0 || results.tracks.length > 0 || results.djs.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Search</h1>
      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search artists, tracks, DJs, or a genre…"
          className="pl-9"
          autoFocus
        />
      </div>

      {!term.trim() ? (
        <EmptyState title="Search for artists, tracks, and DJs" description="Search by name, track title, or genre. Use Discover to browse the live catalogue." />
      ) : loading ? (
        <LoadingState label="Searching…" />
      ) : hasResults ? (
        <div className="flex flex-col gap-8">
          {results!.artists.length > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-ink-0">Artists</h2>
              <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                {results!.artists.map((artist) => (
                  <ArtistCard key={artist.artistId} artist={artist} />
                ))}
              </div>
            </div>
          ) : null}
          {results!.djs.length > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-ink-0">DJs</h2>
              <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
                {results!.djs.map((dj) => (
                  <Link key={dj.djId} to={`/djs/${dj.djId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-3">
                      {dj.photoURL ? <img src={dj.photoURL} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink-0">
                        {dj.name}
                        {dj.verificationStatus === 'verified' ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-400" /> : null}
                      </p>
                      <p className="truncate text-xs text-ink-2">{[dj.city, dj.country].filter(Boolean).join(', ')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {results!.tracks.length > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-ink-0">Tracks</h2>
              <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                {results!.tracks.map((track) => (
                  <TrackCard key={track.trackId} track={track} queue={results!.tracks} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState title={`No results for "${term}"`} description="Try a different artist, track, DJ name, or genre." />
      )}
    </div>
  )
}
