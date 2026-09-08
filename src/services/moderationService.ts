import { doc, collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { CopyrightClaimDoc } from '@/types/moderation'

export function newCopyrightClaimId(): string {
  return doc(collection(db, 'copyrightClaims')).id
}

/** Evidence must be uploaded before submitCopyrightClaim, using this same pre-generated claimId. */
export async function uploadCopyrightEvidence(claimId: string, file: File): Promise<string> {
  const path = `copyrightEvidence/${claimId}/${crypto.randomUUID()}-${file.name}`
  const task = uploadBytesResumable(ref(storage, path), file)
  await new Promise<void>((resolve, reject) => task.on('state_changed', undefined, reject, () => resolve()))
  return getDownloadURL(task.snapshot.ref)
}

export interface SubmitCopyrightClaimInput {
  claimId: string
  trackId: string
  reason: string
  description: string
  claimantName: string
  claimantEmail: string
  claimantCompany?: string
  claimantIsOwnerOrRep: boolean
  claimedRights?: string
  supportingLinks?: string[]
  evidenceUrls?: string[]
  declarationSignature: string
}

export const submitCopyrightClaim = callable<SubmitCopyrightClaimInput, { claimId: string }>('submitCopyrightClaim')

export const submitArtistResponse = callable<{ claimId: string; response: string }, { ok: boolean }>('submitArtistResponse')

export const getCopyrightEvidenceUrls = callable<{ claimId: string }, { urls: string[] }>('getCopyrightEvidenceUrls')

export const submitCounterNotice = callable<{ claimId: string; counterNoticeText: string }, { ok: boolean }>(
  'submitCounterNotice',
)

/** Owner-only: every copyright claim naming this artist, newest first. */
export function subscribeArtistCopyrightClaims(
  artistId: string,
  onChange: (claims: CopyrightClaimDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, 'copyrightClaims'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => d.data() as CopyrightClaimDoc))
    },
    (error) => {
      console.error('[subscribeArtistCopyrightClaims] listener error:', error)
      onError?.(error)
    },
  )
}

export const submitReport = callable<
  { targetType: 'track' | 'artist' | 'dj' | 'user' | 'message' | 'post' | 'story' | 'agreement'; targetId: string; reason: string; description: string },
  { reportId: string }
>('submitReport')
