import { isPlaybackActive } from './playbackActivity'

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
      // A new service worker taking control mid-playback used to force an
      // immediate reload regardless — reasonable most of the time, but it
      // yanks the page out from under anyone actively listening to a track
      // (user-reported: "when I click on the track the page reloads" — it
      // wasn't the click, it was a deploy's new worker activating at that
      // moment). Defer until playback actually stops instead of dropping it.
      deferReloadUntilPlaybackStops(() => {
        if (hasReloaded) return
        hasReloaded = true
        window.location.reload()
      })
    })
  })
}

function deferReloadUntilPlaybackStops(reload: () => void): void {
  if (!isPlaybackActive()) {
    reload()
    return
  }
  const maxWaitMs = 10 * 60 * 1000
  const pollMs = 3000
  const start = Date.now()
  const check = () => {
    if (!isPlaybackActive() || Date.now() - start > maxWaitMs) {
      reload()
      return
    }
    window.setTimeout(check, pollMs)
  }
  window.setTimeout(check, pollMs)
}
