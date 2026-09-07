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
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'sw-src',
      filename: 'sw.ts',
      injectManifest: {
        // The custom SW imports the Firebase SDK, which pulls in more than
        // Workbox's default glob-based precache warning threshold expects.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Wavelength — Independent Music Platform',
        short_name: 'Wavelength',
        description: 'Support the artists you actually listen to.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#050607',
        theme_color: '#050607',
        orientation: 'portrait-primary',
        icons: [
          { src: '/wavelength-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
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
