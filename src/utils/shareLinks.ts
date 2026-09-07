/** Canonical share-link URL builders. Keep these as the single source of truth for link shape. */

export function artistShareUrl(slug: string): string {
  return `${window.location.origin}/artist/${slug}`
}

export function trackShareUrl(slug: string, trackId: string): string {
  return `${window.location.origin}/artist/${slug}/track/${trackId}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers/contexts without Clipboard API permission.
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    } catch {
      return false
    }
  }
}

export function whatsAppShareUrl(url: string, text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
}

export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
}

export function xShareUrl(url: string, text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
}

export function emailShareUrl(url: string, subject: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(url)}`
}
