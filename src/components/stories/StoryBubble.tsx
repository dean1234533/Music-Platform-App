import { clsx } from 'clsx'
import { useArtistSummary } from '@/hooks/useArtistSummary'

export function StoryBubble({
  artistId,
  hasUnseen,
  onClick,
}: {
  artistId: string
  hasUnseen: boolean
  onClick: () => void
}) {
  const artist = useArtistSummary(artistId)
  if (!artist) return null

  return (
    <button onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
      <div
        className={clsx(
          'flex h-16 w-16 items-center justify-center rounded-full p-[2px]',
          hasUnseen ? 'bg-gradient-to-tr from-brand-500 to-support-500' : 'bg-surface-3',
        )}
      >
        <div className="h-full w-full overflow-hidden rounded-full border-2 border-surface-0 bg-surface-2">
          {artist.photoURL ? (
            <img src={artist.photoURL} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-ink-2">
              {artist.name.slice(0, 1)}
            </div>
          )}
        </div>
      </div>
      <span className="w-full truncate text-center text-xs text-ink-2">{artist.name}</span>
    </button>
  )
}
