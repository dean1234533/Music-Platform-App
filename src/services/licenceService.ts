import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { IntendedUse, LicenceAgreementDoc, LicenceRequestDoc } from '@/types/licence'

export interface SubmitLicenceRequestInput {
  trackId: string
  intendedUse: IntendedUse
  territory: string
  expectedDate: string
  venue: string
  message: string
}

const submitRequestCallable = callable<SubmitLicenceRequestInput, { requestId: string; conversationId: string }>(
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

export function subscribeLicenceRequest(requestId: string, onChange: (req: LicenceRequestDoc | null) => void) {
  return onSnapshot(doc(db, 'licenceRequests', requestId), (snap) => {
    onChange(snap.exists() ? (snap.data() as LicenceRequestDoc) : null)
  })
}

export function subscribeRequestsForDj(djId: string, onChange: (rows: LicenceRequestDoc[]) => void) {
  const q = query(collection(db, 'licenceRequests'), where('djId', '==', djId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data() as LicenceRequestDoc)))
}

export function subscribeRequestsForArtist(artistId: string, onChange: (rows: LicenceRequestDoc[]) => void) {
  const q = query(collection(db, 'licenceRequests'), where('artistId', '==', artistId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => d.data() as LicenceRequestDoc)))
}

export function subscribeAgreement(agreementId: string, onChange: (agreement: LicenceAgreementDoc | null) => void) {
  return onSnapshot(doc(db, 'licenceAgreements', agreementId), (snap) => {
    onChange(snap.exists() ? (snap.data() as LicenceAgreementDoc) : null)
  })
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

export const signAgreement = callable<{ agreementId: string; agreedToTerms: boolean }, { ok: boolean; bothAccepted: boolean }>(
  'signAgreement',
)

export const createLicencePaymentSession = callable<
  { agreementId: string; successUrl: string; cancelUrl: string },
  { url: string }
>('createLicencePaymentSession')

export const getSecureDownloadUrl = callable<{ agreementId: string }, { url: string; expiresInSeconds: number }>(
  'getSecureDownloadUrl',
)
