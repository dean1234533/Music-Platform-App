import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Mail, Share2 } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { copyToClipboard, emailShareUrl, facebookShareUrl, whatsAppShareUrl, xShareUrl } from '@/utils/shareLinks'

export function ShareButton({ url, title, text }: { url: string; title: string; text: string }) {
  const [open, setOpen] = useState(false)

  async function handleClick() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // User cancelled or the OS share sheet failed — fall back to the modal.
      }
    }
    setOpen(true)
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleClick}>
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      {open ? <ShareModal url={url} title={title} text={text} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function ShareModal({ url, title, text, onClose }: { url: string; title: string; text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, url, { width: 168, margin: 1, color: { dark: '#0b0e12', light: '#ffffff' } })
    }
  }, [url])

  async function handleCopy() {
    const ok = await copyToClipboard(url)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-2 px-3 py-2.5">
          <input readOnly value={url} className="w-full min-w-0 bg-transparent text-sm text-ink-1 outline-none" onFocus={(e) => e.target.select()} />
          <button onClick={handleCopy} className="shrink-0 rounded-md p-1.5 text-ink-2 hover:bg-surface-3 hover:text-ink-0" aria-label="Copy link">
            {copied ? <Check className="h-4 w-4 text-support-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <ShareLink href={whatsAppShareUrl(url, text)} label="WhatsApp" />
          <ShareLink href={facebookShareUrl(url)} label="Facebook" />
          <ShareLink href={xShareUrl(url, text)} label="X" />
          <ShareLink href={emailShareUrl(url, title)} label="Email" icon={<Mail className="h-4 w-4" />} />
        </div>

        <div className="flex flex-col items-center gap-2 rounded-xl border border-surface-border bg-white p-4">
          <canvas ref={canvasRef} />
          <p className="text-xs text-ink-3">Scan to open on another device</p>
        </div>
      </div>
    </Modal>
  )
}

function ShareLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 rounded-xl border border-surface-border bg-surface-2 py-3 text-xs font-medium text-ink-1 transition hover:bg-surface-3"
    >
      {icon ?? <Share2 className="h-4 w-4" />}
      {label}
    </a>
  )
}
