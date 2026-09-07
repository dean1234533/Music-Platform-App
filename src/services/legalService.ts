import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { LegalDocType } from '@/types/legal'

export const recordRightsDeclaration = callable<{ trackId: string; agreed: boolean }, { ok: boolean; version: string }>(
  'recordRightsDeclaration',
)

export async function recordLegalAcceptance(docType: LegalDocType, version: string, userId: string): Promise<void> {
  await setDoc(doc(db, 'legalAcceptances', `${userId}_${docType}_${version}`), {
    userId,
    docType,
    version,
    acceptedAt: serverTimestamp(),
  })
}

export async function hasAcceptedLegal(userId: string, docType: LegalDocType, version: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'legalAcceptances', `${userId}_${docType}_${version}`))
  return snap.exists()
}
