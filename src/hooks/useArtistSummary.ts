import { useEffect, useState } from 'react'
import { getArtistProfile } from '@/services/artistService'
import type { ArtistProfile } from '@/types/artist'

const cache = new Map<string, ArtistProfile>()

/** Lightweight, cached lookup for the bits of an artist profile used in compact UI (player bar, cards). */
export function useArtistSummary(artistId: string | null): ArtistProfile | null {
  const [profile, setProfile] = useState<ArtistProfile | null>(
    artistId ? (cache.get(artistId) ?? null) : null,
  )

  useEffect(() => {
    if (!artistId) {
      setProfile(null)
      return
    }
    const cached = cache.get(artistId)
    if (cached) {
      setProfile(cached)
      return
    }
    let cancelled = false
    void getArtistProfile(artistId).then((result) => {
      if (cancelled || !result) return
      cache.set(artistId, result)
      setProfile(result)
    })
    return () => {
      cancelled = true
    }
  }, [artistId])

  return profile
}
