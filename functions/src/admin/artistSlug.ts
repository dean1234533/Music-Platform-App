import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../admin.js'
import { requireAdmin, writeAuditLog } from './guard.js'
import { RESERVED_ARTIST_SLUGS } from '../slug.js'

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Slugs are otherwise permanent (frozen by firestore.rules on every
 * self-service update) — this is the one deliberate escape hatch, gated
 * to admins, for genuine cases like a resolved impersonation/trademark
 * report. Every slug this artist has ever used gets repointed to the new
 * canonical one in the same pass, so an old shared link redirects in a
 * single hop no matter how many times the artist's slug has changed.
 */
export const adminChangeArtistSlug = onCall(async (request) => {
  const adminId = await requireAdmin(request)
  const artistId = request.data?.artistId as string | undefined
  const newSlug = request.data?.newSlug as string | undefined
  if (!artistId || typeof artistId !== 'string' || !newSlug || typeof newSlug !== 'string') {
    throw new HttpsError('invalid-argument', 'artistId and newSlug are required.')
  }
  if (newSlug.length > 60 || !SLUG_PATTERN.test(newSlug)) {
    throw new HttpsError('invalid-argument', 'newSlug must be lowercase letters, numbers, and single hyphens only.')
  }
  if (RESERVED_ARTIST_SLUGS.has(newSlug)) {
    throw new HttpsError('invalid-argument', 'That URL is reserved.')
  }

  const artistRef = db.collection('artistProfiles').doc(artistId)
  const newSlugRef = db.collection('artistSlugs').doc(newSlug)

  const oldSlug = await db.runTransaction(async (tx) => {
    const [artistSnap, newSlugSnap] = await Promise.all([tx.get(artistRef), tx.get(newSlugRef)])
    if (!artistSnap.exists) throw new HttpsError('not-found', 'Artist does not exist.')
    if (newSlugSnap.exists) throw new HttpsError('already-exists', 'That URL is already taken.')
    const currentSlug = artistSnap.data()!.slug as string
    if (currentSlug === newSlug) throw new HttpsError('failed-precondition', "That's already this artist's URL.")

    tx.set(newSlugRef, { artistId })
    tx.set(db.collection('artistSlugs').doc(currentSlug), { artistId, redirectTo: newSlug }, { merge: true })
    tx.update(artistRef, { slug: newSlug, updatedAt: FieldValue.serverTimestamp() })
    return currentSlug
  })

  const allSlugDocs = await db.collection('artistSlugs').where('artistId', '==', artistId).get()
  const batch = db.batch()
  for (const doc of allSlugDocs.docs) {
    if (doc.id === newSlug) continue
    batch.set(doc.ref, { artistId, redirectTo: newSlug }, { merge: true })
  }
  await batch.commit()

  await writeAuditLog(adminId, 'change_artist_slug', { artistId, oldSlug, newSlug })
  return { ok: true, oldSlug, newSlug }
})
