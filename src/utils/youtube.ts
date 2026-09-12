/**
 * Validates and normalises artist-submitted YouTube links. We never accept
 * an arbitrary URL/iframe src from a user — every track's playback is
 * backed by nothing more than an 11-character YouTube video ID we extracted
 * and validated ourselves.
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

const URL_PATTERNS: RegExp[] = [
  // youtube.com/watch?v=ID (with any other query params)
  /^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})(?:&.*)?$/,
  // youtu.be/ID
  /^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:\?.*)?$/,
  // youtube.com/embed/ID or youtube-nocookie.com/embed/ID
  /^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})(?:\?.*)?$/,
  // youtube.com/shorts/ID
  /^https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})(?:\?.*)?$/,
  // youtube.com/live/ID
  /^https?:\/\/(?:www\.|m\.)?youtube\.com\/live\/([A-Za-z0-9_-]{11})(?:\?.*)?$/,
]

/** Extracts and validates a canonical 11-character video ID from a YouTube URL, or null if unsupported/invalid. */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  for (const pattern of URL_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match?.[1] && VIDEO_ID_PATTERN.test(match[1])) return match[1]
  }
  return null
}

export function isValidYoutubeVideoId(id: string): boolean {
  return VIDEO_ID_PATTERN.test(id)
}

/** Canonical, shareable watch URL — always rebuilt from the validated ID, never the artist's original pasted URL. */
export function canonicalYoutubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/** Privacy-enhanced embed URL. Playback never starts automatically — `autoplay` is never set here. */
export function youtubeEmbedUrl(videoId: string, params: Record<string, string | number> = {}): string {
  const query = new URLSearchParams({ rel: '0', modestbranding: '1', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  return `https://www.youtube-nocookie.com/embed/${videoId}?${query.toString()}`
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}
