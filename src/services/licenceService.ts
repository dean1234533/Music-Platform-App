import { collection, doc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { DownloadLogDoc, IntendedUse, LicenceAgreementDoc, LicenceOfferDoc, LicenceRequestDoc } from '@/types/licence'

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
const respondCallable = callable<{ requestId: string; action: 'start_negotiation' | 'reject' | 'cancel' }, { status: string }>(
  'respondToLicenceRequest',
)

export async function submitLicenceRequest(input: SubmitLicenceRequestInput) {
  return submitRequestCallable(input)
}

export async function respondToLicenceRequest(requestId: string, action: 'start_negotiation' | 'reject' | 'cancel') {
  return respondCallable({ requestId, action })
}

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
  agreedToTerms: boolean
  legalName: string
  signatureType: 'typed' | 'drawn'
  signatureReference: string
  authorityConfirmed: boolean
}

export const signAgreement = callable<SignAgreementInput, { ok: boolean; bothAccepted: boolean }>('signAgreement')

export const voidAgreement = callable<{ agreementId: string; reason?: string }, { ok: boolean }>('voidAgreement')

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

export const sendOffer = callable<{ requestId: string } & OfferTermsInput, { offerId: string }>('sendOffer')
export const counterOffer = callable<{ requestId: string } & OfferTermsInput, { offerId: string }>('counterOffer')
export const acceptOffer = callable<{ requestId: string }, { agreementId: string }>('acceptOffer')
export const withdrawOffer = callable<{ requestId: string }, { ok: boolean }>('withdrawOffer')

/** Uploaded before calling signAgreement, matching copyrightEvidence's upload-then-reference ordering. */
export async function uploadDrawnSignature(agreementId: string, uid: string, blob: Blob): Promise<string> {
  const path = `licenceSignatures/${agreementId}/${uid}.png`
  const snap = await uploadBytes(ref(storage, path), blob)
  return getDownloadURL(snap.ref)
}

/** Full offer/counter-offer history for a request, oldest first — the backbone of the request activity timeline. Never mutated, only appended to. */
export function subscribeOffersForRequest(
  requestId: string,
  onChange: (offers: LicenceOfferDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, 'licenceOffers'), where('requestId', '==', requestId), orderBy('version', 'asc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as LicenceOfferDoc)),
    (error) => {
      console.error('[subscribeOffersForRequest] listener error:', error)
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
  { agreementId: string; successUrl: string; cancelUrl: string },
  { url: string }
>('createLicencePaymentSession')

export const getSecureDownloadUrl = callable<{ agreementId: string }, { url: string; expiresInSeconds: number }>(
  'getSecureDownloadUrl',
)

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
