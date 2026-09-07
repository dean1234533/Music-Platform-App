import { IMAGE_COMPRESSION_TARGET_MB, IMAGE_DIMENSIONS, type ImageAssetKind } from '@/constants/mediaConfig'

export interface ProcessedImage {
  file: File
  originalSizeBytes: number
  processedSizeBytes: number
}

function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image dimensions.'))
    }
    img.src = url
  })
}

/**
 * Resizes (never upscales) and compresses an image to WebP via
 * browser-image-compression (canvas-based — naturally strips EXIF/GPS on
 * re-encode). Lazy-imported so the library never lands in the main bundle.
 */
export async function compressImage(file: File, kind: ImageAssetKind): Promise<ProcessedImage> {
  const target = IMAGE_DIMENSIONS[kind]
  const originalSizeBytes = file.size

  const source = await loadImageDimensions(file)
  const maxWidthOrHeight = Math.min(Math.max(target.width, target.height), Math.max(source.width, source.height))

  const { default: imageCompression } = await import('browser-image-compression')
  const compressed = await imageCompression(file, {
    maxSizeMB: IMAGE_COMPRESSION_TARGET_MB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.85,
  })

  return {
    file: new File([compressed], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }),
    originalSizeBytes,
    processedSizeBytes: compressed.size,
  }
}
