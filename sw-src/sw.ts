/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

declare const self: ServiceWorkerGlobalScope

// App-shell precaching, generated at build time by vite-plugin-pwa (injectManifest).
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ url }) => /\.(?:png|jpg|jpeg|svg|webp)$/.test(url.pathname),
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
