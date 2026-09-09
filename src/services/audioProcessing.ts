import { PREVIEW_AUDIO_BITRATE_KBPS, STREAMING_AUDIO_BITRATE_KBPS } from '@/constants/mediaConfig'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

export interface AudioDerivative {
  file: File
  sizeBytes: number
}

export interface AudioProcessingResult {
  streaming: AudioDerivative
  preview: AudioDerivative
  djPreview: AudioDerivative | null
  /** Kept for upload progress compatibility. Secure processing never falls back to the master. */
  degraded: boolean
}

export interface AudioMetadata {
  durationSeconds: number
  durationFormatted: string
}

// The wasm core is fetched from a CDN at runtime (the standard ffmpeg.wasm
// pattern — bundling ~25MB of wasm into this app's own build isn't
// practical). Never loaded until deriveAudioAssets is actually called.
const FFMPEG_CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

let ffmpegInstance: FFmpeg | null = null

async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  const { FFmpeg: FFmpegCtor } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')
  const ffmpeg = new FFmpegCtor()
  await ffmpeg.load({
    coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  ffmpegInstance = ffmpeg
  return ffmpeg
}

/**
 * navigator.deviceMemory is Chromium-only — absence just means "unknown",
 * not "fine". The API also deliberately reports coarse, capped values
 * (0.25/0.5/1/2/4/8 GiB) for privacy, so a large share of perfectly capable
 * phones report 2 or 4 — a `< 4` threshold was skipping compression for
 * most real devices before ever attempting it. Only bail out for genuinely
 * constrained ones.
 */
function looksMemoryConstrained(): boolean {
  try {
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory
    const constrained = typeof mem === 'number' && mem < 1
    if (constrained) console.warn(`Skipping client-side audio compression — navigator.deviceMemory reports ${mem}GiB.`)
    return constrained
  } catch {
    return false
  }
}

function extOf(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '.mp3'
}

export async function readAudioMetadata(file: File): Promise<AudioMetadata> {
  const url = URL.createObjectURL(file)
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio()
      const cleanup = () => {
        audio.removeAttribute('src')
        audio.load()
      }
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        const value = audio.duration
        cleanup()
        if (!Number.isFinite(value) || value <= 0) reject(new Error('The audio duration could not be read.'))
        else resolve(value)
      }
      audio.onerror = () => {
        cleanup()
        reject(new Error('The selected file does not contain readable audio metadata.'))
      }
      audio.src = url
    })
    const durationSeconds = Math.max(1, Math.floor(duration))
    const minutes = Math.floor(durationSeconds / 60)
    const seconds = durationSeconds % 60
    return { durationSeconds, durationFormatted: `${minutes}:${String(seconds).padStart(2, '0')}` }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Derives a full-length "streaming" re-encode and a trimmed "preview" clip
 * from one uploaded master, entirely client-side. Processing fails closed:
 * the full master is never substituted for a preview or normal stream.
 */
export async function deriveAudioAssets(
  master: File,
  opts: {
    previewStartSec: number
    previewDurationSec: number
    djPreviewStartSec?: number
    djPreviewDurationSec?: number
    onProgress?: (stage: 'streaming' | 'preview', ratio: number) => void
  },
): Promise<AudioProcessingResult> {
  if (looksMemoryConstrained()) {
    throw new Error('This device does not have enough memory to process the audio safely. Try again on a computer.')
  }

  try {
    const ffmpeg = await loadFFmpeg()
    const { fetchFile } = await import('@ffmpeg/util')
    const inputName = `input${extOf(master.name)}`
    await ffmpeg.writeFile(inputName, await fetchFile(master))

    const onProgressHandler = ({ progress }: { progress: number }) => {
      opts.onProgress?.(currentStage, progress)
    }
    let currentStage: 'streaming' | 'preview' = 'streaming'
    ffmpeg.on('progress', onProgressHandler)

    await ffmpeg.exec(['-i', inputName, '-b:a', `${STREAMING_AUDIO_BITRATE_KBPS}k`, '-vn', 'streaming.m4a'])
    const streamingData = await ffmpeg.readFile('streaming.m4a')
    const streamingFile = new File([streamingData as Uint8Array<ArrayBuffer>], 'streaming.m4a', { type: 'audio/mp4' })

    currentStage = 'preview'
    await ffmpeg.exec([
      '-ss', String(opts.previewStartSec),
      '-i', inputName,
      '-t', String(opts.previewDurationSec),
      '-b:a', `${PREVIEW_AUDIO_BITRATE_KBPS}k`,
      '-vn',
      'preview.m4a',
    ])
    const previewData = await ffmpeg.readFile('preview.m4a')
    const previewFile = new File([previewData as Uint8Array<ArrayBuffer>], 'preview.m4a', { type: 'audio/mp4' })

    let djPreview: AudioDerivative | null = null
    if (opts.djPreviewDurationSec) {
      currentStage = 'preview'
      await ffmpeg.exec([
        '-ss', String(opts.djPreviewStartSec ?? 0),
        '-i', inputName,
        '-t', String(opts.djPreviewDurationSec),
        '-b:a', `${PREVIEW_AUDIO_BITRATE_KBPS}k`,
        '-vn',
        'dj-preview.m4a',
      ])
      const djPreviewData = await ffmpeg.readFile('dj-preview.m4a')
      const file = new File([djPreviewData as Uint8Array<ArrayBuffer>], 'dj-preview.m4a', { type: 'audio/mp4' })
      djPreview = { file, sizeBytes: file.size }
    }

    ffmpeg.off('progress', onProgressHandler)

    return {
      streaming: { file: streamingFile, sizeBytes: streamingFile.size },
      preview: { file: previewFile, sizeBytes: previewFile.size },
      djPreview,
      degraded: false,
    }
  } catch (err) {
    // Swallowing this entirely made a real bug (a blocked CSP fetch, say)
    // indistinguishable from an actual low-memory device — surface it so
    // it's diagnosable from the console instead of just "degraded: true".
    console.warn('Client-side audio processing failed:', err)
    throw new Error('Audio processing failed. Nothing was published and the full track was not used as a preview.')
  }
}

/** Rebuilds only the short derivative when an artist edits preview timing. */
export async function derivePreviewAsset(
  master: File,
  opts: { previewStartSec: number; previewDurationSec: number },
): Promise<AudioDerivative> {
  if (looksMemoryConstrained()) {
    throw new Error('This device does not have enough memory to rebuild the preview safely. Try again on a computer.')
  }
  try {
    const ffmpeg = await loadFFmpeg()
    const { fetchFile } = await import('@ffmpeg/util')
    const inputName = `preview-input${extOf(master.name)}`
    await ffmpeg.writeFile(inputName, await fetchFile(master))
    await ffmpeg.exec([
      '-ss', String(opts.previewStartSec),
      '-i', inputName,
      '-t', String(opts.previewDurationSec),
      '-b:a', `${PREVIEW_AUDIO_BITRATE_KBPS}k`,
      '-vn',
      'preview-edit.m4a',
    ])
    const data = await ffmpeg.readFile('preview-edit.m4a')
    const file = new File([data as Uint8Array<ArrayBuffer>], 'preview.m4a', { type: 'audio/mp4' })
    return { file, sizeBytes: file.size }
  } catch (err) {
    console.warn('Preview regeneration failed:', err)
    throw new Error('The new preview could not be generated. Your existing preview and settings were kept.')
  }
}
