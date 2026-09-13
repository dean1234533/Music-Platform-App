import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import type { Functions } from 'firebase/functions'
import type { FirebaseStorage } from 'firebase/storage'
import type { Messaging } from 'firebase/messaging'

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

// Storage and Functions are lazy, not eager top-level exports like auth/db above — a *static*
// `import ... from 'firebase/storage'` pulls that whole SDK into every page's bundle regardless of
// whether the resulting binding is actually called, since Rollup resolves static imports at the
// module-graph level, not at call time. PlayerContext is mounted unconditionally on every route
// and used to import trackService.ts's static `functions`/`storage` exports just to reach two
// db-only playback calls, dragging both SDKs into the homepage's eager chunk (SEO audit: Speed
// Index 5.4s, ~435KB estimated unused JS). The `import('firebase/storage')` calls below are
// dynamic — only these getters' own call sites, all of them already behind a lazy route/component
// boundary, ever trigger the actual module fetch.
let storageInstance: FirebaseStorage | undefined
export async function getFirebaseStorage(): Promise<FirebaseStorage> {
  if (!storageInstance) {
    const { getStorage } = await import('firebase/storage')
    storageInstance = getStorage(firebaseApp)
  }
  return storageInstance
}

let functionsInstance: Functions | undefined
export async function getFirebaseFunctions(): Promise<Functions> {
  if (!functionsInstance) {
    const { getFunctions } = await import('firebase/functions')
    functionsInstance = getFunctions(firebaseApp)
  }
  return functionsInstance
}

let messagingInstance: Messaging | null | undefined
/**
 * Lazily initialised and support-checked — getMessaging() throws outright
 * on browsers/contexts without Push API support (older Safari, some
 * embedded webviews), so this must never run eagerly at module load.
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance !== undefined) return messagingInstance
  const { getMessaging, isSupported } = await import('firebase/messaging')
  messagingInstance = (await isSupported()) ? getMessaging(firebaseApp) : null
  return messagingInstance
}
