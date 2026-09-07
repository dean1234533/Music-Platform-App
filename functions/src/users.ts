import * as functionsV1 from 'firebase-functions/v1'
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
