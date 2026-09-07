// Mirrors the enforcement in storage.rules — kept here too so artists get an
// instant, friendly error instead of wasting upload bandwidth on a file
// Storage will reject anyway. Constants live in constants/mediaConfig.ts.

import { ALLOWED_AUDIO_TYPES, MAX_AUDIO_MB, MAX_IMAGE_MB, REJECTED_AUDIO_HINTS } from '@/constants/mediaConfig'

export { MAX_AUDIO_MB, MAX_IMAGE_MB, ALLOWED_AUDIO_TYPES }

export function validateAudioFile(file: File): string | null {
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > MAX_AUDIO_MB) {
    return `"${file.name}" is ${sizeMB.toFixed(1)}MB — the limit is ${MAX_AUDIO_MB}MB. Export at a lower bitrate (e.g. MP3 320kbps) and try again.`
  }
  const type = file.type.toLowerCase()
  if (type && !ALLOWED_AUDIO_TYPES.includes(type)) {
    const looksUncompressed = REJECTED_AUDIO_HINTS.some((hint) => type.includes(hint))
    return looksUncompressed
      ? `"${file.name}" looks like an uncompressed format (WAV/FLAC/AIFF). Export as MP3 or AAC first — uncompressed masters aren't accepted to keep storage costs down.`
      : `"${file.name}" isn't a supported audio format. Use MP3, AAC/M4A, or OGG.`
  }
  return null
}

export function validateImageFile(file: File): string | null {
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > MAX_IMAGE_MB) {
    return `"${file.name}" is ${sizeMB.toFixed(1)}MB — the limit is ${MAX_IMAGE_MB}MB.`
  }
  if (file.type && !file.type.startsWith('image/')) {
    return `"${file.name}" isn't an image file.`
  }
  return null
}

export function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`
}
