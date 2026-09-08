import { useEffect, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { listMostSupportedArtists, listRisingArtists } from '@/services/discoveryService'
import { searchPlatform } from '@/services/searchService'
import { ArtistCard } from '@/components/music/ArtistCard'
import { Input } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { ArtistProfile } from '@/types/artist'

export function DJArtistsPage() {
  const [term, setTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ArtistProfile[] | null>(null)
  const [browseArtists, setBrowseArtists] = useState<ArtistProfile[] | null>(null)

  useEffect(() => {
    void Promise.all([listRisingArtists(24), listMostSupportedArtists(24)]).then(([rising, supported]) => {
      const merged = [...rising, ...supported].filter((a, i, arr) => arr.findIndex((b) => b.artistId === a.artistId) === i)
      setBrowseArtists(merged)
    })
  }, [])

  useEffect(() => {
    if (!term.trim()) {
      setSearchResults(null)
      return
    }
    let cancelled = false
    const timeout = setTimeout(() => {
      void searchPlatform(term).then((res) => {
        if (!cancelled) setSearchResults(res.artists)
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [term])

  const artists = searchResults ?? browseArtists

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-0">Artists</h1>
        <p className="mt-1 text-sm text-ink-2">Every artist on the platform, whether or not they have a DJ-promoted track. Visit a profile to request a track directly.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search artists by name…" className="pl-9" />
      </div>

      {artists === null ? (
        <LoadingState />
      ) : artists.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8 text-dj-400" />} title={term.trim() ? `No artists match "${term}"` : 'No artists yet'} />
      ) : (
        <div className="flex flex-wrap gap-4">
          {artists.map((artist) => (
            <ArtistCard key={artist.artistId} artist={artist} />
          ))}
        </div>
      )}
    </div>
  )
}
