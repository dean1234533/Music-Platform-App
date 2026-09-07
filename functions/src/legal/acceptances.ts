import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'

const RIGHTS_DECLARATION_VERSION = '2026-09-07'

const RIGHTS_DECLARATION_TEXT =
  'I confirm that I own, control, or have obtained the necessary rights and permissions to upload, ' +
  'distribute, stream, preview, and offer this recording through this platform.'
const RIGHTS_CONSEQUENCES_TEXT =
  'I understand that uploading music without the necessary rights may result in content removal, ' +
  'account restriction, withheld payouts where legally appropriate, and further action under the platform Terms.'

/**
 * Records a versioned rights declaration for one track upload, called
 * immediately before createTrack so a track never exists without a backing
 * declaration record. NOT a cryptographic signature — same disclaimer as
 * signAgreement's acceptance flow. rightsConfirmed on the track doc itself
 * stays as the cheap rules-native gate; this is the real audit trail.
 */
export const recordRightsDeclaration = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid
  const { trackId, agreed } = request.data ?? {}
  if (!trackId || typeof trackId !== 'string') throw new HttpsError('invalid-argument', 'trackId is required.')
  if (agreed !== true) throw new HttpsError('invalid-argument', 'You must confirm both rights declaration statements.')

  const declarationRef = db.collection('legalAcceptances').doc(`${uid}_rights_declaration_${trackId}`)
  const existing = await declarationRef.get()
  if (existing.exists) {
    throw new HttpsError('failed-precondition', 'A rights declaration has already been recorded for this track.')
  }

  await declarationRef.set({
    userId: uid,
    docType: 'rights_declaration',
    version: RIGHTS_DECLARATION_VERSION,
    trackId,
    declarationText: RIGHTS_DECLARATION_TEXT,
    consequencesText: RIGHTS_CONSEQUENCES_TEXT,
    acceptedAt: FieldValue.serverTimestamp(),
  })

  return { ok: true, version: RIGHTS_DECLARATION_VERSION }
})

/** ToS/Privacy acceptance — no cross-doc validation needed, so this stays a simple append-only record. */
export const recordLegalAcceptance = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid
  const { docType, version } = request.data ?? {}
  if (!['terms', 'privacy', 'copyright_policy', 'dj_licensing_terms'].includes(docType)) {
    throw new HttpsError('invalid-argument', 'Invalid docType.')
  }
  if (!version || typeof version !== 'string') throw new HttpsError('invalid-argument', 'version is required.')

  const ref = db.collection('legalAcceptances').doc(`${uid}_${docType}_${version}`)
  await ref.set(
    { userId: uid, docType, version, acceptedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
  return { ok: true }
})
