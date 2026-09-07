import { Link } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import type { ArtistProfile } from '@/types/artist'
import { formatCount } from '@/utils/format'

export function ArtistCard({ artist }: { artist: ArtistProfile }) {
  return (
    <Link to={`/artist/${artist.slug}`} className="group w-40 shrink-0 sm:w-48">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.3rem] bg-surface-2 ring-1 ring-white/[0.08] transition duration-500 group-hover:-translate-y-1 group-hover:ring-white/20">
        {artist.photoURL ? (
          <img
            src={artist.photoURL}
            alt=""
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-ink-2">
            {artist.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1 truncate text-[15px] font-semibold text-ink-0">
        {artist.name}
        {artist.verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-400" /> : null}
      </div>
      <p className="mt-0.5 truncate text-[13px] text-ink-2">
        {formatCount(artist.followerCount)} followers
      </p>
    </Link>
  )
}
