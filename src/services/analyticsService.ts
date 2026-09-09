import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

/** Server-side counting keeps profileViews/referralViews out of reach of client tampering. Safe to call signed-out. */
export async function recordProfileView(artistId: string, ref?: string | null): Promise<void> {
  const fn = httpsCallable(functions, 'recordProfileView')
  await fn({ artistId, ref: ref || undefined })
}

/** Server-side counting keeps viewCount out of reach of client tampering. Safe to call signed-out. */
export async function recordTrackView(trackId: string, ref?: string | null): Promise<void> {
  const fn = httpsCallable(functions, 'recordTrackView')
  await fn({ trackId, ref: ref || undefined })
}
