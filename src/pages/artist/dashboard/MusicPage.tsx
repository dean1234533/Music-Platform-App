import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistTracks } from '@/services/artistService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { BulkDjOutreachModal } from '@/components/track/BulkDjOutreachModal'
import type { TrackDoc } from '@/types/track'

const VISIBILITY_LABEL: Record<TrackDoc['visibility'], string> = {
  public: 'Public',
  followers: 'Followers',
  supporters: 'Supporters',
  early_access: 'Early access',
  dj_only: 'DJ only',
  private: 'Private',
}

export function MusicPage() {
  const { firebaseUser } = useAuth()
  const [tracks, setTracks] = useState<TrackDoc[] | null>(null)
  const [outreachTrack, setOutreachTrack] = useState<TrackDoc | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistTracks(firebaseUser.uid, setTracks)
  }, [firebaseUser])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-0">Music</h1>
        <Link to="/dashboard/artist/upload">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Upload
          </Button>
        </Link>
      </div>

      {tracks === null ? (
        <LoadingState />
      ) : tracks.length === 0 ? (
        <EmptyState title="You haven't uploaded any tracks yet" />
      ) : (
        <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
          {tracks.map((track) => (
            <div key={track.trackId} className="flex items-center gap-3 px-4 py-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {track.artworkURL ? <img src={track.artworkURL} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-0">{track.title}</p>
                <p className="truncate text-xs text-ink-2">{track.genre}</p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-1">
                {VISIBILITY_LABEL[track.visibility]}
              </span>
              {track.djPromotion ? (
                <span className="shrink-0 rounded-full bg-dj-500/15 px-2.5 py-1 text-xs text-dj-400">DJ promo</span>
              ) : null}
              {track.djPromotion ? (
                <button
                  type="button"
                  onClick={() => setOutreachTrack(track)}
                  className="shrink-0 rounded-full p-1.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink-0"
                  title="Promote to opted-in DJs"
                >
                  <Megaphone className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {outreachTrack ? (
        <BulkDjOutreachModal trackId={outreachTrack.trackId} trackTitle={outreachTrack.title} onClose={() => setOutreachTrack(null)} />
      ) : null}
    </div>
  )
}
