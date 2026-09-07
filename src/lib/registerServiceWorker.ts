/**
 * Registers the service worker and reloads the page once a new one takes
 * control. Without this, sw-src/sw.ts's skipWaiting()/clientsClaim() hand
 * control to the new worker almost immediately, but an already-open tab
 * keeps running whatever JS bundle it already loaded into memory — the new
 * precached assets exist but nothing tells that tab to actually start using
 * them, so a deploy can go unnoticed by anyone with the app already open
 * until they happen to fully close and reopen it.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
      // sw-src/sw.ts calls skipWaiting()/clientsClaim() unconditionally on
      // install, so a new worker takes control on its own — this just makes
      // sure a long-lived open tab actually checks for one, since the
      // browser doesn't always re-check on its own while a tab stays open.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update()
      })
    })

    let hasReloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloaded) return
      hasReloaded = true
      window.location.reload()
    })
  })
}
