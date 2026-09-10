/**
 * Central media processing/upload configuration. Keep every size/dimension/
 * duration limit here rather than scattered through components — mirrored
 * server-side in functions/src/mediaConfig.ts and storage.rules (rules
 * can't import JS, so those numeric literals are hand-kept-in-sync with a
 * comment pointing back here).
 */

export const MAX_AUDIO_MB = 40
export const MAX_IMAGE_MB = 8
export const MAX_VIDEO_MB = 100

export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
]

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export const REJECTED_AUDIO_HINTS = ['wav', 'x-wav', 'wave', 'flac', 'aiff', 'x-aiff']

/** Max pixel dimensions per asset type — never upscale a smaller source image. */
export const IMAGE_DIMENSIONS = {
  profile: { width: 1080, height: 1080 },
  artwork: { width: 1600, height: 1600 },
  story: { width: 1080, height: 1920 },
  cover: { width: 1920, height: 1080 },
  /** Kept larger than profile/story — a copyright claim's evidence needs to stay legible, not just small. */
  evidence: { width: 1600, height: 1600 },
} as const

export type ImageAssetKind = keyof typeof IMAGE_DIMENSIONS

/** Target output for browser-image-compression — sized to comfortably clear MAX_IMAGE_MB. */
export const IMAGE_COMPRESSION_TARGET_MB = 2

export const STORY_MAX_DURATION_SEC = 60
/** Fixed, like Instagram — not artist-configurable. Mark a story a Highlight to keep it past this. */
export const STORY_DURATION_HOURS = 24
export const VIDEO_MAX_DURATION_SEC = 60

/** Story/track video delivery target — 1080p max, 720p is fine on mobile. */
export const VIDEO_MAX_HEIGHT_PX = 1080
export const VIDEO_MOBILE_MAX_HEIGHT_PX = 720
export const VIDEO_TARGET_BITRATE_KBPS = 2500
export const VIDEO_TARGET_FPS = 30
export const VIDEO_AUDIO_BITRATE_KBPS = 128

/** Audio derivative targets — a full-length "streaming" re-encode and a short "preview" clip. */
export const STREAMING_AUDIO_BITRATE_KBPS = 128
export const PREVIEW_AUDIO_BITRATE_KBPS = 96
export const PREVIEW_MIN_DURATION_SEC = 5
export const PREVIEW_MAX_DURATION_SEC = 90
export const PREVIEW_DEFAULT_DURATION_SEC = 45
export const SUGGESTED_PREVIEW_DURATIONS_SEC = [30, 45, 60]
