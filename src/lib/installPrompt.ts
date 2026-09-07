/**
 * Captures `beforeinstallprompt` at module scope, imported at the very top
 * of main.tsx so the listener attaches before React even mounts — the event
 * can fire before the app tree exists, and there is no way to "re-request"
 * it later if missed.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    listeners.forEach((cb) => cb())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    listeners.forEach((cb) => cb())
  })
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt
}

export function wasJustInstalled(): boolean {
  return installed
}

export function onInstallPromptChange(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua)
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferredPrompt
  if (!event) return 'unavailable'
  await event.prompt()
  const { outcome } = await event.userChoice
  deferredPrompt = null
  return outcome
}
