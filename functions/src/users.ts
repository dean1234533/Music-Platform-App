import * as functionsV1 from 'firebase-functions/v1'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './admin.js'

/**
 * Creates the Firestore user document the moment a Firebase Auth account is
 * created. Doing this server-side (rather than trusting the client) means
 * roles/subscriptionStatus start from a known-safe default no matter what
 * the client sends — the client-side ensureUserDocument() fallback in the
 * app only covers the rare case this trigger hasn't run yet.
 */
export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const ref = db.collection('users').doc(user.uid)
  const existing = await ref.get()
  if (existing.exists) return

  await ref.set({
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    roles: [],
    onboardingComplete: false,
    subscriptionStatus: 'none',
    notificationPreferences: { email: true, inApp: true },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
})

/**
 * Keeps artistProfiles/djProfiles/tracks' denormalized roleActive /
 * artistRoleActive fields in sync with users/{uid}.roles.
 *
 * This exists because firestore.rules' actual enforcement of "hide a
 * stepped-back account's profile/tracks" can't use a live cross-document
 * roleActiveFor(uid, role) check on these collections' READ rules without
 * breaking every list-style query against them — Firestore rejects an
 * entire list query outright (permission-denied for every candidate, not
 * just an inactive one) when its rule needs a get()/exists() call and the
 * query has no equality filter narrow enough to bound the candidate set.
 * Confirmed live: this broke listRisingArtists, listMostSupportedArtists,
 * listNewReleaseTracks, and DJ discovery for every caller, signed in or
 * not (user-reported: "a fan can not see artist profile cards").
 *
 * A plain per-document boolean needs no extra read, so those same list
 * queries work again. It defaults to true when absent (firestore.rules'
 * `.get('roleActive', true)`), so every pre-existing document needed no
 * backfill — this trigger is the only thing that ever sets it explicitly,
 * and only when a role genuinely flips.
 */
export const onUserRolesChange = onDocumentWritten('users/{uid}', async (event) => {
  const after = event.data?.after?.data()
  if (!after) return // Account deleted — deleteAccount already tears down profiles/tracks itself.
  const before = event.data?.before?.data()

  const uid = event.params.uid
  const beforeRoles = (before?.roles ?? []) as string[]
  const afterRoles = (after.roles ?? []) as string[]
  const wasArtist = beforeRoles.includes('artist')
  const isArtist = afterRoles.includes('artist')
  const wasDj = beforeRoles.includes('dj')
  const isDj = afterRoles.includes('dj')

  if (wasArtist !== isArtist) {
    const artistRef = db.collection('artistProfiles').doc(uid)
    if ((await artistRef.get()).exists) {
      await artistRef.update({ roleActive: isArtist })
    }
    const tracksSnap = await db.collection('tracks').where('artistId', '==', uid).get()
    for (let i = 0; i < tracksSnap.docs.length; i += 400) {
      const batch = db.batch()
      for (const doc of tracksSnap.docs.slice(i, i + 400)) batch.update(doc.ref, { artistRoleActive: isArtist })
      await batch.commit()
    }
  }

  if (wasDj !== isDj) {
    const djRef = db.collection('djProfiles').doc(uid)
    if ((await djRef.get()).exists) {
      await djRef.update({ roleActive: isDj })
    }
  }
})
