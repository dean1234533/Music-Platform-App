import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Handshake, Megaphone, Plus, Radio, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeArtistTracks } from '@/services/artistService'
import { subscribeArtistCopyrightClaims } from '@/services/moderationService'
import { Button } from '@/components/common/Button'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { BulkDjOutreachModal } from '@/components/track/BulkDjOutreachModal'
import { CopyrightClaimBanner } from '@/components/track/CopyrightClaimBanner'
import { TrackDealSettingsModal } from '@/components/licence/TrackDealSettingsModal'
import { TrackDjAccessModal } from '@/components/licence/TrackDjAccessModal'
import type { TrackDoc } from '@/types/track'
import { OPEN_CLAIM_STATUSES, type CopyrightClaimDoc } from '@/types/moderation'
import { deleteTrack, isTrackAcceptingDjRequests } from '@/services/trackService'
import { useToast } from '@/contexts/ToastContext'

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
  const { notify } = useToast()
  const [tracks, setTracks] = useState<TrackDoc[] | null>(null)
  const [claims, setClaims] = useState<CopyrightClaimDoc[]>([])
  const [outreachTrack, setOutreachTrack] = useState<TrackDoc | null>(null)
  const [dealsTrack, setDealsTrack] = useState<TrackDoc | null>(null)
  const [djAccessTrack, setDjAccessTrack] = useState<TrackDoc | null>(null)
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null)

  async function handleDelete(track: TrackDoc) {
    if (!window.confirm(`Delete “${track.title}” and its audio files? This cannot be undone.`)) return
    setDeletingTrackId(track.trackId)
    try {
      await deleteTrack(track.trackId)
      notify('Track and unused media deleted.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete the track.', 'error')
    } finally {
      setDeletingTrackId(null)
    }
  }

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistTracks(firebaseUser.uid, setTracks)
  }, [firebaseUser])

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeArtistCopyrightClaims(firebaseUser.uid, setClaims)
  }, [firebaseUser])

  // Latest open claim per track — claims are already ordered newest-first.
  const openClaimByTrackId = useMemo(() => {
    const map = new Map<string, CopyrightClaimDoc>()
    for (const claim of claims) {
      if (!OPEN_CLAIM_STATUSES.includes(claim.status)) continue
      if (!map.has(claim.trackId)) map.set(claim.trackId, claim)
    }
    return map
  }, [claims])

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

      {openClaimByTrackId.size > 0 ? (
        <div className="flex flex-col gap-3">
          {Array.from(openClaimByTrackId.entries()).map(([trackId, claim]) => (
            <CopyrightClaimBanner
              key={claim.claimId}
              claim={claim}
              trackTitle={tracks?.find((t) => t.trackId === trackId)?.title ?? 'this track'}
            />
          ))}
        </div>
      ) : null}

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
              {isTrackAcceptingDjRequests(track) ? (
                <span className="shrink-0 rounded-full bg-dj-500/15 px-2.5 py-1 text-xs text-dj-400">DJ promo</span>
              ) : null}
              {isTrackAcceptingDjRequests(track) ? (
                <button
                  type="button"
                  onClick={() => setOutreachTrack(track)}
                  className="shrink-0 rounded-full p-1.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink-0"
                  title="Promote to opted-in DJs"
                >
                  <Megaphone className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDjAccessTrack(track)}
                className="shrink-0 rounded-full p-1.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink-0"
                title="DJ access"
              >
                <Radio className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDealsTrack(track)}
                className="shrink-0 rounded-full p-1.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink-0"
                title="DJ deals"
              >
                <Handshake className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(track)}
                disabled={deletingTrackId === track.trackId}
                className="shrink-0 rounded-full p-1.5 text-ink-3 transition hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-50"
                title="Delete track"
                aria-label={`Delete ${track.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {outreachTrack ? (
        <BulkDjOutreachModal trackId={outreachTrack.trackId} trackTitle={outreachTrack.title} onClose={() => setOutreachTrack(null)} />
      ) : null}
      {dealsTrack ? <TrackDealSettingsModal track={dealsTrack} onClose={() => setDealsTrack(null)} /> : null}
      {djAccessTrack ? <TrackDjAccessModal track={djAccessTrack} onClose={() => setDjAccessTrack(null)} /> : null}
    </div>
  )
}
