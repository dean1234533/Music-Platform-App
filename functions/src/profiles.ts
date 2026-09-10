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
 * Grants the artist role — always for request.auth.uid, never a
 * client-supplied id, and the caller only ever names the action ("create my
 * artist profile"); this function alone decides the resulting role. A
 * regular account keeps exactly the one role it picked at onboarding for
 * life — this only ever re-affirms that same role (e.g. finishing profile
 * setup after the role was already granted, or a retried/replayed call, or
 * an admin re-adding a role it had stepped back from). Adding a role the
 * account doesn't already have is admin-only; see the mutual-exclusion
 * check below. firestore.rules' users/{userId} update rule freezes a
 * regular account's own roles field after its one-time initial signup
 * write, so this Cloud Function — which has admin-SDK access and bypasses
 * that rule — has to enforce the same restriction itself.
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

    // One role per account — a regular account keeps exactly the single
    // role it picked at onboarding for life; this path only re-affirms that
    // same role (e.g. finishing profile setup, or an admin re-adding a role
    // it had stepped back from), never adds a second one alongside it.
    // Changing a regular account's role at all is admin-only, matching
    // firestore.rules' users/{userId} update rule, which already freezes
    // this field completely for a non-admin account after its first write —
    // this Cloud Function has admin-SDK access and so must enforce the same
    // restriction itself rather than relying on those rules to stop it.
    const currentRoles: string[] = userSnap.data()!.roles ?? []
    const isAdmin = currentRoles.includes('admin')
    if (!isAdmin && currentRoles.length > 0 && !currentRoles.includes('artist')) {
      throw new HttpsError(
        'permission-denied',
        'Your account already has a role, and accounts can only have one active role. An admin needs to change it for you.',
      )
    }

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

    // See createArtistProfile above — one role per account, enforced here
    // rather than left to the UI to hide.
    const currentRoles: string[] = userSnap.data()!.roles ?? []
    const isAdmin = currentRoles.includes('admin')
    if (!isAdmin && currentRoles.length > 0 && !currentRoles.includes('dj')) {
      throw new HttpsError(
        'permission-denied',
        'Your account already has a role, and accounts can only have one active role. An admin needs to change it for you.',
      )
    }

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
