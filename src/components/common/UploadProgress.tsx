import { AlertTriangle } from 'lucide-react'
import { formatFileSize } from '@/utils/uploadLimits'
import type { MediaUploadState } from '@/hooks/useMediaUpload'

const STAGE_LABEL: Record<string, string> = {
  processing: 'Processing media…',
  uploading: 'Uploading…',
  done: 'Done',
}

export function UploadProgress({ state }: { state: MediaUploadState }) {
  if (state.stage === 'idle') return null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-surface-border bg-surface-2 p-4">
      {state.stage === 'error' ? (
        <p className="flex items-center gap-2 text-sm text-danger-500">
          <AlertTriangle className="h-4 w-4" />
          {state.error}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink-0">{STAGE_LABEL[state.stage] ?? state.stage}</span>
            <span className="tabular-nums text-ink-2">{state.progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-200"
              style={{ width: `${state.progressPercent}%` }}
            />
          </div>
        </>
      )}

      {state.degraded ? (
        <p className="flex items-center gap-2 text-xs text-warning-500">
          <AlertTriangle className="h-3.5 w-3.5" />
          Compression wasn't available on this device — uploading the original file instead.
        </p>
      ) : null}

      {state.originalSizeBytes != null && state.processedSizeBytes != null && !state.degraded ? (
        <p className="text-xs text-ink-3">
          Original: {formatFileSize(state.originalSizeBytes)} → Optimised: {formatFileSize(state.processedSizeBytes)}
          {state.originalSizeBytes > state.processedSizeBytes
            ? ` (saved ${formatFileSize(state.originalSizeBytes - state.processedSizeBytes)})`
            : ''}
        </p>
      ) : null}
    </div>
  )
}
