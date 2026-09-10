import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, LifeBuoy } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSmartBack } from '@/hooks/useSmartBack'
import { submitSupportMessage, subscribeMySupportMessages } from '@/services/helpService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { LoadingState } from '@/components/common/StateViews'
import type { SupportMessageDoc } from '@/types/moderation'

function formatDate(value: unknown): string {
  const ts = value as { toDate?: () => Date } | null
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function SupportPage() {
  const { firebaseUser } = useAuth()
  const goBack = useSmartBack('/app')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [openMessages, setOpenMessages] = useState<SupportMessageDoc[] | null>(null)

  useEffect(() => {
    if (!firebaseUser) return
    return subscribeMySupportMessages(firebaseUser.uid, setOpenMessages)
  }, [firebaseUser])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await submitSupportMessage({ subject: subject.trim(), message: message.trim() })
      setSent(true)
      setSubject('')
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <button onClick={goBack} className="flex w-fit items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0 active:opacity-60">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-400">
          <LifeBuoy className="h-3.5 w-3.5" /> Support
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-ink-0">Contact support</h1>
        <p className="mt-1 text-sm text-ink-2">Have an issue or a question? Send us a message and we'll get back to you.</p>
      </div>

      {sent ? (
        <p className="rounded-xl border border-support-500/30 bg-support-500/5 px-4 py-3 text-sm text-support-400">
          Thanks — your message has been sent. We'll notify you here once we reply.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" required minLength={3} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <TextArea id="message" rows={6} required minLength={10} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-danger-500">{error}</p> : null}
          <Button type="submit" loading={submitting} className="w-full">
            Send message
          </Button>
        </form>
      )}

      {openMessages === null ? (
        <LoadingState />
      ) : openMessages.length === 0 ? null : (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-3">Awaiting a reply</h2>
          <div className="flex flex-col gap-3">
            {openMessages.map((msg) => (
              <div key={msg.supportMessageId} className="rounded-xl border border-surface-border bg-surface-1 px-4 py-3">
                <p className="text-sm font-medium text-ink-0">{msg.subject}</p>
                <p className="mt-1 text-xs leading-5 text-ink-2">{msg.message}</p>
                <p className="mt-1 text-[11px] text-ink-3">{formatDate(msg.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
