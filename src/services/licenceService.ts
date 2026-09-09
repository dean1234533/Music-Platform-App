import { and, collection, doc, getDocs, onSnapshot, or, orderBy, query, where } from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'
import { auth, db, firebaseApp, storage } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { DownloadLogDoc, IntendedUse, LicenceAgreementDoc, LicenceOfferDoc, LicenceRequestDoc, LicenceRequestEventDoc } from '@/types/licence'

export type LicencePartyRole = 'artist' | 'dj'

export interface SubmitLicenceRequestInput {
  trackId: string
  intendedUse: IntendedUse
  territory: string
  expectedDate: string
  venue: string
  message: string
  dealId?: string
  requestedStartDate?: string
  requestedEndDate?: string
  recordingIntention?: boolean
  streamingIntention?: boolean
}

const submitRequestCallable = callable<SubmitLicenceRequestInput, { requestId: string; agreementId: string | null }>(
  'submitLicenceRequest',
)
const respondCallable = callable<{ requestId: string; action: 'start_negotiation' | 'reject' | 'cancel'; actingRole: LicencePartyRole }, { status: string }>(
  'respondToLicenceRequest',
)

export async function submitLicenceRequest(input: SubmitLicenceRequestInput) {
  return submitRequestCallable(input)
}

export async function respondToLicenceRequest(requestId: string, action: 'start_negotiation' | 'reject' | 'cancel', actingRole: LicencePartyRole) {
  return respondCallable({ requestId, action, actingRole })
}

/** Removes a closed (rejected/cancelled/expired) request from the caller's own list — the doc and the other party's view are untouched. */
export const dismissLicenceRequest = callable<{ requestId: string }, { ok: boolean }>('dismissLicenceRequest')

export function subscribeLicenceRequest(
  requestId: string,
  onChange: (req: LicenceRequestDoc | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'licenceRequests', requestId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as LicenceRequestDoc) : null)
    },
    (error) => {
      console.error('[subscribeLicenceRequest] listener error:', error)
      onError?.(error)
    },
  )
}

export function subscribeRequestsForDj(
  djId: string,
  onChange: (rows: LicenceRequestDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'licenceRequests'), where('djId', '==', djId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as LicenceRequestDoc)),
    (error) => {
      console.error('[subscribeRequestsForDj] listener error:', error)
      onError?.(error)
    },
  )
}

export function subscribeRequestsForArtist(
  artistId: string,
  onChange: (rows: LicenceRequestDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'licenceRequests'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as LicenceRequestDoc)),
    (error) => {
      console.error('[subscribeRequestsForArtist] listener error:', error)
      onError?.(error)
    },
  )
}

export function subscribeAgreement(
  agreementId: string,
  onChange: (agreement: LicenceAgreementDoc | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'licenceAgreements', agreementId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as LicenceAgreementDoc) : null)
    },
    (error) => {
      console.error('[subscribeAgreement] listener error:', error)
      onError?.(error)
    },
  )
}

export interface ProposeAgreementInput {
  requestId: string
  permittedUse: string
  territory: string
  startDate: string
  expiryDate: string | null
  licenceFeeMinor: number
  currency: string
  attributionRequirements: string
  recordingPermission: boolean
  streamingPermission: boolean
  commercialUse: boolean
  redistributionAllowed: boolean
  resaleAllowed: boolean
  additionalTerms: string
}

export const proposeAgreement = callable<ProposeAgreementInput, { agreementId: string; agreementVersion: number }>(
  'proposeAgreement',
)

export interface SignAgreementInput {
  agreementId: string
  agreementVersion: number
  contentHash: string
  agreedToTerms: boolean
  legalName: string
  signatureType: 'typed' | 'drawn'
  signatureReference: string
  authorityConfirmed: boolean
  actingRole: LicencePartyRole
}

export const signAgreement = callable<SignAgreementInput, { ok: boolean; bothAccepted: boolean }>('signAgreement')

export const voidAgreement = callable<{ agreementId: string; reason?: string; actingRole: LicencePartyRole }, { ok: boolean }>('voidAgreement')

/** Short-lived signed URLs for any drawn signature images on this agreement — empty for a party who signed by typing their name instead. */
export const getSignatureImageUrls = callable<
  { agreementId: string },
  { signatures: { role: 'artist' | 'dj'; url: string }[] }
>('getSignatureImageUrls')

export interface OfferTermsInput {
  priceMinor: number
  currency: string
  permittedUse: string
  territory: string
  startDate: string
  expiryDate: string | null
  recordingPermission: boolean
  streamingPermission: boolean
  promotionalMixPermission: boolean
  attributionRequirements: string
  redistributionAllowed: boolean
  resaleAllowed: boolean
  remixAllowed: boolean
  additionalTerms: string
  /** Optional deadline for accepting this offer — distinct from expiryDate (the licence's own duration). ISO date or null. */
  offerExpiresAt?: string | null
}

export const sendOffer = callable<{ requestId: string; actingRole: LicencePartyRole } & OfferTermsInput, { offerId: string }>('sendOffer')
export const counterOffer = callable<{ requestId: string; actingRole: LicencePartyRole } & OfferTermsInput, { offerId: string }>('counterOffer')
export const acceptOffer = callable<{ requestId: string; actingRole: LicencePartyRole }, { agreementId: string }>('acceptOffer')
export const acceptExistingDeal = callable<{ requestId: string; actingRole: LicencePartyRole }, { agreementId: string }>('acceptExistingDeal')
export const rejectOffer = callable<{ requestId: string; reason?: string; actingRole: LicencePartyRole }, { ok: boolean }>('rejectOffer')
export const withdrawOffer = callable<{ requestId: string; actingRole: LicencePartyRole }, { ok: boolean }>('withdrawOffer')

/**
 * Uploaded before calling signAgreement, matching copyrightEvidence's upload-then-reference
 * ordering. Storage rules deliberately set `allow read: if false` on this path (nothing in the
 * product displays a stored signature image back — see storage.rules) — calling getDownloadURL()
 * here would be rejected by that same rule, so the storage path itself is the reference, not a
 * fetchable URL.
 */
export async function uploadDrawnSignature(agreementId: string, uid: string, actingRole: LicencePartyRole, blob: Blob): Promise<string> {
  const path = `licenceSignatures/${agreementId}/${actingRole}-${uid}.png`
  const snap = await uploadBytes(ref(storage, path), blob)
  return snap.ref.fullPath
}

/** Full offer/counter-offer history for a request, oldest first — the backbone of the request activity timeline. Never mutated, only appended to. */
/**
 * The query must itself restrict to documents the caller is allowed to read
 * (djId == uid OR artistId == uid) — Firestore evaluates a `list` query's
 * security rule against the query shape, not just against each returned
 * document, so a bare `where('requestId', '==', requestId)` with no
 * uid-matching clause is rejected outright (permission-denied) even though
 * every actual matching offer document would individually satisfy the rule.
 */
export function subscribeOffersForRequest(
  requestId: string,
  uid: string,
  onChange: (offers: LicenceOfferDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(
    collection(db, 'licenceOffers'),
    and(where('requestId', '==', requestId), or(where('djId', '==', uid), where('artistId', '==', uid))),
    orderBy('version', 'asc'),
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as LicenceOfferDoc)),
    (error) => {
      console.error('[subscribeOffersForRequest] listener error:', error)
      onError?.(error)
    },
  )
}

export function subscribeRequestEvents(
  requestId: string,
  onChange: (events: LicenceRequestEventDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'licenceRequests', requestId, 'events'), orderBy('createdAt', 'asc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as LicenceRequestEventDoc)),
    (error) => {
      console.error('[subscribeRequestEvents] listener error:', error)
      onError?.(error)
    },
  )
}

export function subscribeOffer(
  offerId: string,
  onChange: (offer: LicenceOfferDoc | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'licenceOffers', offerId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as LicenceOfferDoc) : null)
    },
    (error) => {
      console.error('[subscribeOffer] listener error:', error)
      onError?.(error)
    },
  )
}

export const createLicencePaymentSession = callable<
  { agreementId: string; successUrl: string; cancelUrl: string; actingRole: LicencePartyRole },
  { url: string }
>('createLicencePaymentSession')

/**
 * downloadLicensedTrack is an onRequest (not onCall) function — it streams the file directly
 * through its own HTTP response with Content-Disposition set by that function's own code,
 * rather than handing back a Storage-signed URL. A signed URL's responseDisposition hint asking
 * the browser to download instead of playing the audio inline isn't reliably honoured (confirmed:
 * the browser still opened its native player), and this project's GCP identity doesn't have IAM
 * permission to configure the bucket's CORS policy for a client-side fetch()-and-save workaround
 * either — streaming through a function whose headers this code controls directly sidesteps both.
 */
export async function downloadLicensedTrack(agreementId: string, actingRole: LicencePartyRole): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in required.')
  const idToken = await user.getIdToken()
  const region = 'us-central1'
  const url = `https://${region}-${firebaseApp.options.projectId}.cloudfunctions.net/downloadLicensedTrack?agreementId=${encodeURIComponent(agreementId)}&actingRole=${encodeURIComponent(actingRole)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error((body as { error?: string } | null)?.error || 'Could not prepare the download.')
  }
  const disposition = res.headers.get('content-disposition') ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'track'
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(blobUrl)
}

/** Download history for the signed-in DJ. */
export async function listDjDownloadLogs(djId: string): Promise<DownloadLogDoc[]> {
  const q = query(collection(db, 'downloadLogs'), where('djId', '==', djId), orderBy('timestamp', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as DownloadLogDoc)
}

/** Licence history for the signed-in DJ. */
export async function listDjAgreements(djId: string): Promise<LicenceAgreementDoc[]> {
  const q = query(collection(db, 'licenceAgreements'), where('djId', '==', djId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as LicenceAgreementDoc)
}

/** Licence history for the signed-in artist. */
export async function listArtistAgreements(artistId: string): Promise<LicenceAgreementDoc[]> {
  const q = query(collection(db, 'licenceAgreements'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as LicenceAgreementDoc)
}

/** Download history for the signed-in artist's tracks. */
export async function listArtistDownloadLogs(artistId: string): Promise<DownloadLogDoc[]> {
  const q = query(collection(db, 'downloadLogs'), where('artistId', '==', artistId), orderBy('timestamp', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as DownloadLogDoc)
}
