import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging'

// Falls back to the real project config rather than failing outright when
// VITE_* env vars don't reach the build (seen in practice with Cloudflare's
// Workers-Builds CI, where the dashboard's "Variables and Secrets" section
// is a runtime Worker binding, not a build-time shell env var — env.local
// or a real CI build-vars section should still be preferred when available).
// These are all public client identifiers, safe to hardcode — see README.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAma8nf3wFJcq6I3kJ_qO4YNu900F7-uCg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'music-platform-app-c45ac.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'music-platform-app-c45ac',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'music-platform-app-c45ac.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '118149049811',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:118149049811:web:7a0499f0831ba6cf609326',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-VPE6S8RZF0',
}

export const FIREBASE_VAPID_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  'BN9dq93h_z4WIC4Iiw4RS5jVDg-M7zYm1D72P-nsvTn5q7Lmf8zQbIhJdtTBlfEOpUtlaQteCFw1MZy-PEfl2q8'

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)
export const functions = getFunctions(firebaseApp)

let messagingInstance: Messaging | null | undefined
/**
 * Lazily initialised and support-checked — getMessaging() throws outright
 * on browsers/contexts without Push API support (older Safari, some
 * embedded webviews), so this must never run eagerly at module load.
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance !== undefined) return messagingInstance
  messagingInstance = (await isSupported()) ? getMessaging(firebaseApp) : null
  return messagingInstance
}
