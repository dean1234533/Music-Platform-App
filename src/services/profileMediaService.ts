import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { compressImage } from './imageProcessing'

/** Fan/DJ avatar — reuses the existing (previously unused) users/{uid}/profile/ Storage path. */
export async function uploadUserAvatar(uid: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  const { file: compressed } = await compressImage(file, 'profile')
  return uploadWithProgress(`users/${uid}/profile/avatar.webp`, compressed, onProgress)
}

/** Artist profile photo — reuses the existing artwork/ path with a fixed filename prefix rather than adding a new Storage rules block. */
export async function uploadArtistPhoto(artistId: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  const { file: compressed } = await compressImage(file, 'profile')
  return uploadWithProgress(`artists/${artistId}/artwork/profile-photo.webp`, compressed, onProgress)
}

export async function uploadArtistCover(artistId: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  const { file: compressed } = await compressImage(file, 'cover')
  return uploadWithProgress(`artists/${artistId}/artwork/cover-image.webp`, compressed, onProgress)
}

async function uploadWithProgress(path: string, file: File, onProgress?: (percent: number) => void): Promise<string> {
  const task = uploadBytesResumable(ref(storage, path), file)
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      () => resolve(),
    )
  })
  return getDownloadURL(task.snapshot.ref)
}
