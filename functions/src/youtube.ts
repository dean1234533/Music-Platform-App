const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

export function isValidYoutubeVideoId(id: string): boolean {
  return VIDEO_ID_PATTERN.test(id)
}
