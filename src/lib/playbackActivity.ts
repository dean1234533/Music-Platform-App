/**
 * A tiny cross-module flag so code outside React (registerServiceWorker.ts,
 * which runs before the app tree exists) can tell whether audio is actively
 * playing right now. The player's Audio() instance is never attached to the
 * document (see PlayerContext.tsx), so `document.querySelector('audio')`
 * would never find it — this is the only way to ask "is something playing"
 * from outside PlayerContext without wiring a DOM event across module
 * boundaries.
 */
let playing = false

export function setPlaybackActive(value: boolean): void {
  playing = value
}

export function isPlaybackActive(): boolean {
  return playing
}
