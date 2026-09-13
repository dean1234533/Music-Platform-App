import { useEffect, useState } from 'react'
import { Heart, ListPlus } from 'lucide-react'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { likeTrack, subscribeIsLiked, unlikeTrack } from '@/services/likeService'
import { PlaylistPickerModal } from '@/components/music/PlaylistPickerModal'
import type { TrackDoc } from '@/types/track'

export function TrackActions({ track, labels = false }: { track: TrackDoc; labels?: boolean }) {
  const { firebaseUser, hasRole } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [liked, setLiked] = useState(false)
  const [pending, setPending] = useState(false)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)

  useEffect(() => {
    if (!firebaseUser) {
      setLiked(false)
      return
    }
    return subscribeIsLiked(firebaseUser.uid, track.trackId, setLiked)
  }, [firebaseUser, track.trackId])

  function requireAccount(action: () => void) {
    if (!firebaseUser) {
      notify('Sign in to save music and build playlists.', 'info')
      navigate('/sign-in')
      return
    }
    action()
  }

  // Liking/playlists are fan-only (mirrors crates being dj-only) — hide the controls
  // entirely for a signed-in artist/dj account instead of showing a dead-end button.
  if (firebaseUser && !hasRole('fan')) return null

  async function toggleLike() {
    if (!firebaseUser || pending) return
    setPending(true)
    try {
      if (liked) {
        await unlikeTrack(firebaseUser.uid, track.trackId)
        notify(`Removed “${track.title}” from your library.`, 'info')
      } else {
        await likeTrack(firebaseUser.uid, track.trackId)
        notify(`Saved “${track.title}” to your library.`)
      }
    } catch {
      notify('Could not update your library. Please try again.', 'error')
    } finally {
      setPending(false)
    }
  }

  const baseClass = labels
    ? 'flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-ink-1 transition hover:bg-white/[0.08] hover:text-ink-0'
    : 'grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-black/25 text-ink-1 backdrop-blur transition hover:bg-white/[0.09] hover:text-ink-0'

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => requireAccount(() => void toggleLike())}
          disabled={pending}
          className={clsx(baseClass, liked && 'border-danger-500/25 text-danger-500')}
          aria-label={liked ? 'Remove from library' : 'Save to library'}
          title={liked ? 'Remove from library' : 'Save to library'}
        >
          <Heart size={17} className={clsx(liked && 'fill-current')} />
          {labels ? <span>{liked ? 'Saved' : 'Save'}</span> : null}
        </button>
        <button
          type="button"
          onClick={() => requireAccount(() => setShowPlaylistPicker(true))}
          className={baseClass}
          aria-label="Add to playlist"
          title="Add to playlist"
        >
          <ListPlus size={18} />
          {labels ? <span>Add to playlist</span> : null}
        </button>
      </div>
      {showPlaylistPicker ? <PlaylistPickerModal track={track} onClose={() => setShowPlaylistPicker(false)} /> : null}
    </>
  )
}
