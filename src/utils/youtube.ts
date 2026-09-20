/**
 * Extracts a video ID from the YouTube URL shapes people actually paste:
 * watch?v=, youtu.be/, /shorts/, and already-embed URLs. Returns null for
 * anything else so callers can fall back to a plain link instead of trying
 * to embed something that isn't YouTube.
 */
export function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      return parsed.pathname.slice(1).split('/')[0] || null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/]+)/)
      if (shortsMatch) return shortsMatch[1]!
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/)
      if (embedMatch) return embedMatch[1]!
    }
    return null
  } catch {
    return null
  }
}

export function isYouTubeUrl(url: string): boolean {
  return getYouTubeVideoId(url) !== null
}

/** youtube-nocookie.com avoids setting tracking cookies until the viewer actually presses play. */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`
}
