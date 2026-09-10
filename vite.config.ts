import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered manually in src/main.tsx instead: the auto-injected
      // registerSW.js registers the worker but never reloads an already-open
      // tab once a new one takes control, so users could keep running a
      // stale bundle indefinitely after a deploy despite skipWaiting()/
      // clientsClaim() in sw-src/sw.ts already handing it control.
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'sw-src',
      filename: 'sw.ts',
      injectManifest: {
        // The custom SW imports the Firebase SDK, which pulls in more than
        // Workbox's default glob-based precache warning threshold expects.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'BackTheVibes — Independent Music Platform',
        short_name: 'BackTheVibes',
        description: 'Support the artists you actually listen to.',
        id: '/',
        start_url: '/app/home',
        scope: '/',
        display: 'standalone',
        background_color: '#050607',
        theme_color: '#050607',
        orientation: 'portrait-primary',
        icons: [
          { src: '/icons/backthevibes-app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/backthevibes-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/backthevibes-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/backthevibes-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Runtime image caching + Firebase Messaging background handling both
      // live in sw-src/sw.ts now (injectManifest gives us a real, editable
      // service worker instead of the auto-generated one `workbox:` configures).
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
