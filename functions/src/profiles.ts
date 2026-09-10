import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'
import { requireActiveUser } from './roles.js'
import { enforceRateLimit } from './rateLimit.js'
import { RESERVED_ARTIST_SLUGS, slugify } from './slug.js'

const MAX_NAME = 80
const MAX_BIO = 1000
const MAX_LOCATION = 120
const MAX_GENRE = 40
const MAX_GENRES = 15

function sanitizeGenres(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((g): g is string => typeof g === 'string')
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, MAX_GENRES)
    .map((g) => g.slice(0, MAX_GENRE))
}

/**
 * The only legitimate way an already-onboarded account gains the artist
 * role — firestore.rules' users/{userId} update rule freezes a regular
 * account's own roles field after its one-time initial signup write, so
 * this is the trusted, server-validated replacement for the client write
 * that used to create the profile and grant the role directly. The caller
 * only ever names the action ("create my artist profile"); this function
 * decides the resulting role, always for request.auth.uid, never a
 * client-supplied id. Idempotent: a retried/replayed call, or an account
 * that already has a profile (e.g. an admin re-adding a role it had
 * stepped back from), just gets its existing slug back and the role
 * re-affirmed, rather than erroring or creating a duplicate.
 */
export const createArtistProfile = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid
  await requireActiveUser(uid)
  await enforceRateLimit(`createArtistProfile_${uid}`, 5, 60 * 60)

  const name = typeof request.data?.name === 'string' ? request.data.name.trim() : ''
  const bio = typeof request.data?.bio === 'string' ? request.data.bio.trim().slice(0, MAX_BIO) : ''
  const location = typeof request.data?.location === 'string' ? request.data.location.trim().slice(0, MAX_LOCATION) : ''
  const genres = sanitizeGenres(request.data?.genres)
  if (!name || name.length > MAX_NAME) {
    throw new HttpsError('invalid-argument', 'A valid artist name is required.')
  }

  const userRef = db.collection('users').doc(uid)
  const artistRef = db.collection('artistProfiles').doc(uid)

  return db.runTransaction(async (tx) => {
    const [userSnap, existingProfile] = await Promise.all([tx.get(userRef), tx.get(artistRef)])
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'Account is not fully set up yet.')

    if (existingProfile.exists) {
      tx.update(userRef, { roles: FieldValue.arrayUnion('artist'), updatedAt: FieldValue.serverTimestamp() })
      return { slug: existingProfile.data()!.slug as string }
    }

    // Same collision-retry loop the old client transaction used, now
    // trusted server-side: a reserved/impersonation-prone word (e.g.
    // "admin", "support") is treated as a soft collision, not a hard
    // rejection, so a legitimate artist with that name still gets a
    // working URL, just not the bare unqualified one.
    const baseSlug = slugify(name) || `artist-${uid.slice(0, 6)}`
    let candidate = baseSlug
    let attempt = 0
    while (attempt < 25) {
      if (!RESERVED_ARTIST_SLUGS.has(candidate)) {
        const existingSlug = await tx.get(db.collection('artistSlugs').doc(candidate))
        if (!existingSlug.exists) break
      }
      attempt += 1
      candidate = `${baseSlug}-${attempt + 1}`
    }
    if (attempt >= 25) throw new HttpsError('already-exists', `The artist URL "${baseSlug}" is already taken.`)

    tx.set(db.collection('artistSlugs').doc(candidate), { artistId: uid })
    tx.set(artistRef, {
      artistId: uid,
      slug: candidate,
      name,
      nameLower: name.toLowerCase(),
      bio,
      genres,
      location,
      socialLinks: {},
      photoURL: null,
      coverURL: null,
      verified: false,
      followerCount: 0,
      supporterCount: 0,
      djAllowRequests: 'verified_only',
      trackCount: 0,
      perks: [],
      storiesDjEnabled: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(userRef, { roles: FieldValue.arrayUnion('artist'), updatedAt: FieldValue.serverTimestamp() })
    return { slug: candidate }
  })
})

/**
 * The only legitimate way an already-onboarded account gains the DJ role —
 * see createArtistProfile's doc comment above, same reasoning applies here.
 */
export const createDJProfile = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const uid = request.auth.uid
  await requireActiveUser(uid)
  await enforceRateLimit(`createDJProfile_${uid}`, 5, 60 * 60)

  const name = typeof request.data?.name === 'string' ? request.data.name.trim() : ''
  const bio = typeof request.data?.bio === 'string' ? request.data.bio.trim().slice(0, MAX_BIO) : ''
  const country = typeof request.data?.country === 'string' ? request.data.country.trim().slice(0, MAX_LOCATION) : ''
  const city = typeof request.data?.city === 'string' ? request.data.city.trim().slice(0, MAX_LOCATION) : ''
  const genres = sanitizeGenres(request.data?.genres)
  if (!name || name.length > MAX_NAME) {
    throw new HttpsError('invalid-argument', 'A valid DJ name is required.')
  }

  const userRef = db.collection('users').doc(uid)
  const djRef = db.collection('djProfiles').doc(uid)

  await db.runTransaction(async (tx) => {
    const [userSnap, existingProfile] = await Promise.all([tx.get(userRef), tx.get(djRef)])
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'Account is not fully set up yet.')

    if (existingProfile.exists) {
      tx.update(userRef, { roles: FieldValue.arrayUnion('dj'), updatedAt: FieldValue.serverTimestamp() })
      return
    }

    tx.set(djRef, {
      djId: uid,
      name,
      realName: null,
      photoURL: null,
      coverURL: null,
      bio,
      genres,
      country,
      city,
      venues: [],
      website: null,
      socialLinks: {},
      verificationStatus: 'unverified',
      bulkOutreachOptIn: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(userRef, { roles: FieldValue.arrayUnion('dj'), updatedAt: FieldValue.serverTimestamp() })
  })

  return { ok: true }
})
