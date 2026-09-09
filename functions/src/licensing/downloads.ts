import { HttpsError, onRequest } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAuth } from 'firebase-admin/auth'
import { db } from '../admin.js'
import { requireActiveUser, userHasRole } from '../roles.js'
import { resolveLicencePartyRole } from './party.js'

const ALLOWED_ORIGINS = ['https://backthevibes.com', 'https://www.backthevibes.com', 'http://localhost:5173']

function setCorsHeaders(req: { headers: Record<string, unknown> }, res: { set: (name: string, value: string) => void }) {
  const origin = req.headers.origin as string | undefined
  if (origin && ALLOWED_ORIGINS.includes(origin)) res.set('Access-Control-Allow-Origin', origin)
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Authorization')
  res.set('Vary', 'Origin')
}

/**
 * The only way a full-quality original ever reaches a DJ. Re-checks every
 * condition from the spec server-side — auth, role, agreement ownership,
 * track match, approval, payment, expiry, and revocation — before streaming
 * the file. Storage rules independently block public/direct reads of
 * originals, so this function is the sole path to the file.
 *
 * This is an onRequest (not onCall) HTTP function, and streams the file
 * directly through this function's own response rather than handing back a
 * Storage-signed URL: a signed URL's responseDisposition hint asking the
 * browser to download rather than play the audio inline is not reliably
 * honoured (confirmed — the browser still opened its native player), and
 * this project's GCP identity doesn't have IAM permission to configure the
 * bucket's CORS policy for a client-side fetch()-and-save workaround either.
 * Streaming through a function whose own response headers this code sets
 * directly sidesteps both problems — Content-Disposition is guaranteed, and
 * CORS is this function's own to control.
 */
export const downloadLicensedTrack = onRequest(async (req, res) => {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }

  try {
    const authHeader = req.headers.authorization
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }
    const decoded = await getAuth().verifyIdToken(authHeader.slice('Bearer '.length))
    const djId = decoded.uid
    await requireActiveUser(djId)

    const agreementId = req.query.agreementId
    const requestedRole = req.query.actingRole
    if (typeof agreementId !== 'string' || !agreementId) {
      res.status(400).json({ error: 'agreementId is required.' })
      return
    }

    if (!(await userHasRole(djId, 'dj'))) {
      res.status(403).json({ error: 'A DJ profile is required to download licensed tracks.' })
      return
    }

    const agreementRef = db.collection('licenceAgreements').doc(agreementId)
    const agreementSnap = await agreementRef.get()
    if (!agreementSnap.exists) {
      res.status(404).json({ error: 'Agreement not found.' })
      return
    }
    const agreement = agreementSnap.data()!

    try {
      if (resolveLicencePartyRole(agreement, djId, typeof requestedRole === 'string' ? requestedRole : null) !== 'dj') {
        res.status(403).json({ error: 'This agreement does not belong to you.' })
        return
      }
    } catch (err) {
      res.status(403).json({ error: err instanceof HttpsError ? err.message : 'This agreement does not belong to you.' })
      return
    }
    if (agreement.status !== 'active') {
      res.status(412).json({ error: 'Agreement is not active.' })
      return
    }
    if (agreement.legalHold) {
      res.status(403).json({ error: 'This agreement is under legal hold.' })
      return
    }
    if (agreement.downloadRevoked) {
      res.status(403).json({ error: 'Download access has been revoked.' })
      return
    }
    const requiresPayment = (agreement.licenceFeeMinor ?? 0) > 0
    if (requiresPayment && !agreement.paidAt) {
      res.status(412).json({ error: 'Payment has not been completed.' })
      return
    }
    if (agreement.expiryDate) {
      const expiry = new Date(agreement.expiryDate as string)
      if (expiry.getTime() < Date.now()) {
        res.status(412).json({ error: 'This licence has expired.' })
        return
      }
    }

    const trackSnap = await db.collection('tracks').doc(agreement.trackId).get()
    if (!trackSnap.exists) {
      res.status(404).json({ error: 'Track not found.' })
      return
    }
    const track = trackSnap.data()!
    if (track.artistId !== agreement.artistId) {
      res.status(412).json({ error: 'Track/artist mismatch on this agreement.' })
      return
    }
    if (track.takenDown === true || (track.restrictedCapabilities ?? []).includes('dj_licensing')) {
      res.status(403).json({ error: 'This track is under a copyright review — downloads are temporarily unavailable. Your signed agreement record is preserved.' })
      return
    }
    const expectedOriginalPrefix = `artists/${track.artistId}/originals/${agreement.trackId}.`
    if (typeof track.originalAudioPath !== 'string' || !track.originalAudioPath.startsWith(expectedOriginalPrefix)) {
      res.status(412).json({ error: 'The licensed original file path is invalid.' })
      return
    }

    const bucket = getStorage().bucket()
    const file = bucket.file(track.originalAudioPath as string)
    const [exists] = await file.exists()
    if (!exists) {
      res.status(404).json({ error: 'Original file is unavailable.' })
      return
    }
    // The object's own stored contentType (set by uploadBytesResumable from the original File's
    // real MIME type) — forcing application/octet-stream here made the browser fall back to a
    // generic document association on download instead of recognising it as audio.
    const [metadata] = await file.getMetadata()
    const contentType = metadata.contentType || 'audio/mpeg'

    const extension = ((track.originalAudioPath as string).split('.').pop() || 'mp3').toLowerCase()
    const safeTitle = String(track.title ?? 'track').replace(/[^\w -]+/g, '').trim().slice(0, 80) || 'track'

    await Promise.all([
      agreementRef.update({ downloadCount: FieldValue.increment(1) }),
      db.collection('downloadLogs').add({
        djId,
        artistId: agreement.artistId,
        trackId: agreement.trackId,
        agreementId,
        fileVersion: agreement.trackVersion ?? 1,
        timestamp: FieldValue.serverTimestamp(),
      }),
    ])

    res.set('Content-Disposition', `attachment; filename="${safeTitle}.${extension}"`)
    res.set('Content-Type', contentType)
    if (metadata.size) res.set('Content-Length', String(metadata.size))
    file.createReadStream().on('error', () => res.end()).pipe(res)
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Could not prepare the download.' })
    }
  }
})
