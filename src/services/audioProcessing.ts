import { PREVIEW_AUDIO_BITRATE_KBPS, STREAMING_AUDIO_BITRATE_KBPS } from '@/constants/mediaConfig'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

export interface AudioDerivative {
  file: File
  sizeBytes: number
}

export interface AudioProcessingResult {
  streaming: AudioDerivative
  preview: AudioDerivative
  /** True if ffmpeg.wasm couldn't run and the master was used as a stand-in for both derivatives. */
  degraded: boolean
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

/** navigator.deviceMemory is Chromium-only — absence just means "unknown", not "fine". */
function looksMemoryConstrained(): boolean {
  try {
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory
    return typeof mem === 'number' && mem < 4
  } catch {
    return false
  }
}

function extOf(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '.mp3'
}

function degradedFallback(master: File): AudioProcessingResult {
  return {
    streaming: { file: master, sizeBytes: master.size },
    preview: { file: master, sizeBytes: master.size },
    degraded: true,
  }
}

/**
 * Derives a full-length "streaming" re-encode and a trimmed "preview" clip
 * from one uploaded master, entirely client-side. Falls back to using the
 * untrimmed master as a stand-in for both derivatives — clearly flagged via
 * `degraded: true`, never silently — if ffmpeg.wasm fails to load or the
 * device looks memory-constrained.
 */
export async function deriveAudioAssets(
  master: File,
  opts: {
    previewStartSec: number
    previewDurationSec: number
    onProgress?: (stage: 'streaming' | 'preview', ratio: number) => void
  },
): Promise<AudioProcessingResult> {
  if (looksMemoryConstrained()) return degradedFallback(master)

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

    ffmpeg.off('progress', onProgressHandler)

    return {
      streaming: { file: streamingFile, sizeBytes: streamingFile.size },
      preview: { file: previewFile, sizeBytes: previewFile.size },
      degraded: false,
    }
  } catch (err) {
    // Swallowing this entirely made a real bug (a blocked CSP fetch, say)
    // indistinguishable from an actual low-memory device — surface it so
    // it's diagnosable from the console instead of just "degraded: true".
    console.warn('Client-side audio compression failed, uploading the original file instead:', err)
    return degradedFallback(master)
  }
}
