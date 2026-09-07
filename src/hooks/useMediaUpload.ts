import { useCallback, useState } from 'react'
import { uploadBytesResumable, type UploadTask } from 'firebase/storage'

export type UploadStage = 'idle' | 'processing' | 'uploading' | 'done' | 'error'

export interface MediaUploadState {
  stage: UploadStage
  progressPercent: number
  error: string | null
  originalSizeBytes: number | null
  processedSizeBytes: number | null
  /** True when compression couldn't run and the original file was used as a stand-in. */
  degraded: boolean
}

const IDLE_STATE: MediaUploadState = {
  stage: 'idle',
  progressPercent: 0,
  error: null,
  originalSizeBytes: null,
  processedSizeBytes: null,
  degraded: false,
}

/**
 * Shared "Processing media… / Uploading…" state machine. Processing progress
 * (ffmpeg.wasm/browser-image-compression) and upload progress (Storage's
 * uploadBytesResumable) are reported through the same 0-100 scale but the
 * `stage` field is what the UI should key off to label them differently.
 */
export function useMediaUpload() {
  const [state, setState] = useState<MediaUploadState>(IDLE_STATE)

  const reset = useCallback(() => setState(IDLE_STATE), [])

  const setProcessing = useCallback((progressPercent: number) => {
    setState((prev) => ({ ...prev, stage: 'processing', progressPercent, error: null }))
  }, [])

  const setProcessed = useCallback((originalSizeBytes: number, processedSizeBytes: number, degraded: boolean) => {
    setState((prev) => ({ ...prev, originalSizeBytes, processedSizeBytes, degraded }))
  }, [])

  const setError = useCallback((message: string) => {
    setState((prev) => ({ ...prev, stage: 'error', error: message }))
  }, [])

  /** For multi-file uploads (e.g. uploadTrackAssets' own aggregate progress callback) that don't map to a single UploadTask. */
  const setUploadProgress = useCallback((progressPercent: number) => {
    setState((prev) => ({ ...prev, stage: 'uploading', progressPercent }))
  }, [])

  const setDone = useCallback(() => {
    setState((prev) => ({ ...prev, stage: 'done', progressPercent: 100 }))
  }, [])

  /** Wraps a Storage uploadBytesResumable task, tracking real progress and returning the completed task. */
  const upload = useCallback((task: UploadTask): Promise<void> => {
    setState((prev) => ({ ...prev, stage: 'uploading', progressPercent: 0 }))
    return new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          const pct = snapshot.totalBytes > 0 ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0
          setState((prev) => ({ ...prev, progressPercent: pct }))
        },
        (err) => {
          setState((prev) => ({ ...prev, stage: 'error', error: err.message }))
          reject(err)
        },
        () => {
          setState((prev) => ({ ...prev, stage: 'done', progressPercent: 100 }))
          resolve()
        },
      )
    })
  }, [])

  return { state, reset, setProcessing, setProcessed, setError, setUploadProgress, setDone, upload }
}

/** Convenience wrapper so callers don't need to import uploadBytesResumable themselves just to build a task. */
export { uploadBytesResumable }
