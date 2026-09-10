import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LifeBuoy } from 'lucide-react'
import { submitSupportMessage } from '@/services/helpService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'

export function SupportPage() {
  const navigate = useNavigate()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await submitSupportMessage({ subject: subject.trim(), message: message.trim() })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-10">
      <button onClick={() => navigate(-1)} className="flex w-fit items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0 active:opacity-60">
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
          Thanks — your message has been sent.
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
    </div>
  )
}
