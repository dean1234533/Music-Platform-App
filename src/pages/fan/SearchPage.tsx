import { useEffect, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink-0">Search</h1>
      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search artists or tracks…"
          className="pl-9"
          autoFocus
        />
      </div>

      {!term.trim() ? (
        <EmptyState title="Search for artists and tracks" description="Genre, album, and DJ search expand in later phases." />
      ) : loading ? (
        <LoadingState label="Searching…" />
      ) : results && (results.artists.length > 0 || results.tracks.length > 0) ? (
        <div className="flex flex-col gap-8">
          {results.artists.length > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-ink-0">Artists</h2>
              <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                {results.artists.map((artist) => (
                  <ArtistCard key={artist.artistId} artist={artist} />
                ))}
              </div>
            </div>
          ) : null}
          {results.tracks.length > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-ink-0">Tracks</h2>
              <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                {results.tracks.map((track) => (
                  <TrackCard key={track.trackId} track={track} queue={results.tracks} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState title={`No results for "${term}"`} description="Try a different artist or track name." />
      )}
    </div>
  )
}
