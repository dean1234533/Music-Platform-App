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
  { value: 'public', label: 'Everyone' },
  { value: 'followers', label: 'Followers' },
  { value: 'supporters', label: 'Supporters' },
  { value: 'early_access', label: 'Early access' },
  { value: 'dj_only', label: 'DJ only' },
  { value: 'private', label: 'Private' },
]

/**
 * What each audience actually gets, shown to the artist before they
 * publish/edit — never fabricated, mirrors the exact server-side ladder in
 * canAccessTrackYoutubeLink. There is no separate "preview" tier any more:
 * the YouTube link is either visible (full track, on YouTube) or not shown
 * at all to that audience yet.
 */
export const ACCESS_SUMMARY: Record<TrackVisibility, { public: string; followers: string; supporters: string }> = {
  public: { public: 'Can watch on YouTube', followers: 'Can watch on YouTube', supporters: 'Can watch on YouTube' },
  followers: { public: 'Link not shown yet', followers: 'Can watch on YouTube', supporters: 'Can watch on YouTube' },
  supporters: { public: 'Link not shown yet', followers: 'Link not shown yet', supporters: 'Can watch on YouTube' },
  early_access: { public: 'Link not shown yet', followers: 'Shown from your scheduled date', supporters: 'Can watch now' },
  dj_only: { public: 'Not shown', followers: 'Not shown', supporters: 'Not shown' },
  private: { public: 'Not shown', followers: 'Not shown', supporters: 'Not shown' },
}

export interface TrackAccessInfo {
  /** Whether this viewer should be shown the YouTube link — a display hint only. getTrackYoutubeInfo is the real, server-side gate regardless of what this says. */
  fullAccess: boolean
  playLabel: string
  /** Shown when the link isn't available to this viewer yet — null when the viewer already has access. */
  lockedMessage: string | null
}

/**
 * Purely descriptive — never used to grant playback. The actual entitlement
 * decision lives entirely in getTrackYoutubeInfo (canAccessTrackYoutubeLink);
 * this only decides what the UI *says* before that server call resolves.
 */
export function describeTrackAccess(
  track: TrackDoc,
  viewer: { isOwner: boolean; isAdmin: boolean; isFollowing: boolean; isSupporting: boolean },
): TrackAccessInfo {
  if (viewer.isOwner || viewer.isAdmin) {
    return { fullAccess: true, playLabel: 'Play on YouTube', lockedMessage: null }
  }
  if (track.visibility === 'public') {
    return { fullAccess: true, playLabel: 'Play on YouTube', lockedMessage: null }
  }
  if (track.visibility === 'followers') {
    return viewer.isFollowing || viewer.isSupporting
      ? { fullAccess: true, playLabel: 'Play on YouTube', lockedMessage: null }
      : { fullAccess: false, playLabel: 'Locked', lockedMessage: 'Follow this artist for free to unlock this track.' }
  }
  if (track.visibility === 'supporters') {
    return viewer.isSupporting
      ? { fullAccess: true, playLabel: 'Play on YouTube', lockedMessage: null }
      : { fullAccess: false, playLabel: 'Locked', lockedMessage: 'Support this artist to unlock this track and other exclusive releases.' }
  }
  if (track.visibility === 'early_access') {
    if (viewer.isSupporting) return { fullAccess: true, playLabel: 'Play on YouTube', lockedMessage: null }
    const now = Date.now()
    if (track.publicReleaseAt && now >= track.publicReleaseAt.toMillis()) {
      return { fullAccess: true, playLabel: 'Play on YouTube', lockedMessage: null }
    }
    if (viewer.isFollowing && track.followerReleaseAt && now >= track.followerReleaseAt.toMillis()) {
      return { fullAccess: true, playLabel: 'Play on YouTube', lockedMessage: null }
    }
    const releaseCopy = track.followerReleaseAt
      ? ` Unlocked for followers from ${new Date(track.followerReleaseAt.toMillis()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
      : ''
    return {
      fullAccess: false,
      playLabel: 'Locked',
      lockedMessage: viewer.isFollowing
        ? `This is an early access release.${releaseCopy}`
        : `Support this artist to hear this early access release now.${releaseCopy} Otherwise, follow to unlock it when it's released.`,
    }
  }
  // dj_only / private: locked for a non-owner, non-admin viewer — no follow/support CTA applies.
  return { fullAccess: false, playLabel: 'Locked', lockedMessage: null }
}
