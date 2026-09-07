/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

declare const self: ServiceWorkerGlobalScope

// Without these, a new deploy installs but stays "waiting" until every open
// tab is fully closed, so users keep getting the stale cached app shell.
self.skipWaiting()
clientsClaim()

// Navigation requests (the document itself) go network-first, registered
// ahead of precacheAndRoute so it wins the route match. Precaching the
// document is otherwise a trap: the cached Response carries whatever HTTP
// headers (CSP, etc.) were live at the moment it was captured, and nothing
// about a headers-only deploy (e.g. editing public/_headers) changes any
// precached asset's content hash — so the service worker never has a
// reason to reinstall and refetch, and a stale document (with stale
// headers) can keep being served indefinitely. Falls back to the cache
// only when actually offline.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages' }),
)

// App-shell precaching, generated at build time by vite-plugin-pwa (injectManifest).
precacheAndRoute(self.__WB_MANIFEST)

// Same-origin only: matching by extension alone would also catch Firebase
// Storage download URLs (a different origin) whose pathname happens to end
// in .jpg/.png/etc — including access-controlled paths like copyright
// evidence or licence-signature images. Caching those for up to 30 days
// would keep serving them from this device after the underlying Storage
// rule/token access is revoked, bypassing the entitlement check entirely.
// Restricting to the app's own origin limits this cache to bundled/public
// assets (icons, static artwork served through this origin), where that
// risk doesn't apply.
registerRoute(
  ({ url }) => url.origin === self.location.origin && /\.(?:png|jpg|jpeg|webp)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// Hardcoded rather than read from Vite env vars: this file is bundled as a
// standalone service worker outside the app's module graph, and these are
// public client identifiers anyway (same values as src/lib/firebase.ts) —
// update both places together if the Firebase project ever changes.
const firebaseConfig = {
  apiKey: 'AIzaSyAma8nf3wFJcq6I3kJ_qO4YNu900F7-uCg',
  authDomain: 'music-platform-app-c45ac.firebaseapp.com',
  projectId: 'music-platform-app-c45ac',
  storageBucket: 'music-platform-app-c45ac.firebasestorage.app',
  messagingSenderId: '118149049811',
  appId: '1:118149049811:web:7a0499f0831ba6cf609326',
}

const messaging = getMessaging(initializeApp(firebaseConfig))

interface PushLinkData {
  linkTo?: string
}

onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title ?? 'New notification'
  const data = (payload.data ?? {}) as PushLinkData
  void self.registration.showNotification(title, {
    body: payload.notification?.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data,
  })
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const linkTo = (event.notification.data as PushLinkData | undefined)?.linkTo ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return (client as WindowClient).focus()
      }
      return self.clients.openWindow(linkTo)
    }),
  )
})
