import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label } from '@/components/common/Input'
import { SignaturePad } from './SignaturePad'
import { signAgreement, uploadDrawnSignature } from '@/services/licenceService'

export function SignAgreementModal({
  agreementId,
  agreementVersion,
  contentHash,
  uid,
  onClose,
  onSigned,
}: {
  agreementId: string
  agreementVersion: number
  contentHash: string
  uid: string
  onClose: () => void
  onSigned: () => void
}) {
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [legalName, setLegalName] = useState('')
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false)
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed')
  const [drawnBlob, setDrawnBlob] = useState<Blob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    agreedToTerms && authorityConfirmed && legalName.trim() && (signatureType === 'typed' || drawnBlob) && !submitting

  async function handleSign() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const signatureReference =
        signatureType === 'typed' ? legalName.trim() : await uploadDrawnSignature(agreementId, uid, drawnBlob!)
      await signAgreement({
        agreementId,
        agreementVersion,
        contentHash,
        agreedToTerms: true,
        legalName: legalName.trim(),
        signatureType,
        signatureReference,
        authorityConfirmed: true,
      })
      onSigned()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign this agreement.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Sign agreement" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex items-start gap-2.5 text-ink-1">
          <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-0.5 h-4 w-4" />
          I have read and agree to the terms of this agreement.
        </label>

        <div>
          <Label>Full legal name</Label>
          <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Your full legal name" />
        </div>

        <label className="flex items-start gap-2.5 text-ink-1">
          <input
            type="checkbox"
            checked={authorityConfirmed}
            onChange={(e) => setAuthorityConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          I confirm that I have authority to enter into this agreement.
        </label>

        <div>
          <Label>Signature</Label>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => setSignatureType('typed')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${signatureType === 'typed' ? 'bg-brand-500 text-[#080a05]' : 'bg-surface-2 text-ink-1'}`}
            >
              Type
            </button>
            <button
              type="button"
              onClick={() => setSignatureType('drawn')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${signatureType === 'drawn' ? 'bg-brand-500 text-[#080a05]' : 'bg-surface-2 text-ink-1'}`}
            >
              Draw
            </button>
          </div>
          {signatureType === 'typed' ? (
            <p className="rounded-lg border border-surface-border bg-surface-2 px-4 py-3 font-serif text-xl italic text-ink-0">
              {legalName.trim() || 'Your typed signature'}
            </p>
          ) : (
            <SignaturePad onDone={setDrawnBlob} />
          )}
          {signatureType === 'drawn' && drawnBlob ? <p className="text-xs text-support-400">Signature captured.</p> : null}
        </div>

        <p className="text-xs text-ink-3">
          This is a statement made under penalty of submitting false information, not a cryptographic signature.
        </p>

        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button onClick={handleSign} loading={submitting} disabled={!canSubmit}>
          Sign agreement
        </Button>
      </div>
    </Modal>
  )
}
