import type { TrackDoc, TrackVisibility } from '@/types/track'

/** Short, non-technical tier labels — spec calls for exactly this vocabulary over the raw enum values. */
export const TRACK_ACCESS_LABEL: Record<TrackVisibility, string> = {
  public: 'PUBLIC',
  followers: 'FOLLOWERS',
  supporters: 'SUPPORTER EXCLUSIVE',
  early_access: 'EARLY ACCESS',
  dj_only: 'DJ PROMO',
  private: 'PRIVATE',
}

export const VISIBILITY_OPTIONS: { value: TrackVisibility; label: string }[] = [
  { value: 'public', label: 'Public stream' },
  { value: 'followers', label: 'Followers only' },
  { value: 'supporters', label: 'Supporters only' },
  { value: 'early_access', label: 'Early access' },
  { value: 'dj_only', label: 'DJ only' },
  { value: 'private', label: 'Private' },
]

const previewCopy = (sec: number) => `${sec}-second preview`
const notAvailable = () => 'Not available'
const fullTrack = () => 'Full track'

/** What each audience actually gets, shown to the artist before they publish/edit — never fabricated, mirrors the exact server-side ladder in canPreviewTrack/canStreamFullTrack. */
export const ACCESS_SUMMARY: Record<TrackVisibility, { public: (sec: number) => string; followers: (sec: number) => string; supporters: (sec: number) => string }> = {
  public: { public: fullTrack, followers: fullTrack, supporters: fullTrack },
  followers: { public: previewCopy, followers: fullTrack, supporters: fullTrack },
  supporters: { public: previewCopy, followers: previewCopy, supporters: fullTrack },
  early_access: { public: previewCopy, followers: () => 'Full track from your scheduled date', supporters: () => 'Full track now' },
  dj_only: { public: notAvailable, followers: notAvailable, supporters: notAvailable },
  private: { public: notAvailable, followers: notAvailable, supporters: notAvailable },
}

export interface TrackAccessInfo {
  /** Whether this viewer should expect the full track to actually play — a display hint only. getTrackPlaybackUrl is the real, server-side gate regardless of what this says. */
  fullAccess: boolean
  playLabel: string
  /** Shown once the preview ends (or up front, locked) — null when the viewer already has full access. */
  lockedMessage: string | null
}

/**
 * Purely descriptive — never used to grant playback. The actual entitlement
 * decision lives entirely in getTrackPlaybackUrl (canPreviewTrack /
 * canStreamFullTrack); this only decides what the UI *says* before that
 * server call resolves, so the player's fallback-to-preview stays correct
 * even if a stale isFollowing/isSupporting snapshot makes this guess wrong.
 */
export function describeTrackAccess(
  track: TrackDoc,
  viewer: { isOwner: boolean; isAdmin: boolean; isFollowing: boolean; isSupporting: boolean },
): TrackAccessInfo {
  if (viewer.isOwner || viewer.isAdmin) {
    return { fullAccess: true, playLabel: 'Play Full Track', lockedMessage: null }
  }
  if (track.visibility === 'public') {
    return { fullAccess: true, playLabel: 'Play Full Track', lockedMessage: null }
  }
  if (track.visibility === 'followers') {
    return viewer.isFollowing
      ? { fullAccess: true, playLabel: 'Play Full Track', lockedMessage: null }
      : { fullAccess: false, playLabel: 'Play Preview', lockedMessage: "You've reached the end of the preview. Follow to hear the full track." }
  }
  if (track.visibility === 'supporters') {
    return viewer.isSupporting
      ? { fullAccess: true, playLabel: 'Play Full Track', lockedMessage: null }
      : { fullAccess: false, playLabel: 'Play Preview', lockedMessage: 'Support this artist to unlock the full track and exclusive releases.' }
  }
  if (track.visibility === 'early_access') {
    if (viewer.isSupporting) return { fullAccess: true, playLabel: 'Play Full Track', lockedMessage: null }
    const now = Date.now()
    if (track.publicReleaseAt && now >= track.publicReleaseAt.toMillis()) {
      return { fullAccess: true, playLabel: 'Play Full Track', lockedMessage: null }
    }
    if (viewer.isFollowing && track.followerReleaseAt && now >= track.followerReleaseAt.toMillis()) {
      return { fullAccess: true, playLabel: 'Play Full Track', lockedMessage: null }
    }
    const releaseCopy = track.followerReleaseAt
      ? ` Full track for followers from ${new Date(track.followerReleaseAt.toMillis()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
      : ''
    return {
      fullAccess: false,
      playLabel: 'Play Preview',
      lockedMessage: viewer.isFollowing
        ? `This is an early access release.${releaseCopy}`
        : `Support this artist to hear this early access release now.${releaseCopy} Otherwise, follow to unlock it when it's released.`,
    }
  }
  // dj_only / private: preview-only (or no preview at all) for a non-owner, non-admin viewer — no follow/support CTA applies.
  return { fullAccess: false, playLabel: 'Play Preview', lockedMessage: null }
}
