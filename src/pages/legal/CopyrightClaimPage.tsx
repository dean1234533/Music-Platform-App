import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSmartBack } from '@/hooks/useSmartBack'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/common/BrandMark'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { useAuth } from '@/contexts/AuthContext'
import { newCopyrightClaimId, submitCopyrightClaim, uploadCopyrightEvidence } from '@/services/moderationService'
import { compressImage } from '@/services/imageProcessing'

const MAX_EVIDENCE_FILES = 5

/**
 * Dedicated copyright-claim form — separate from the generic ReportTrackModal
 * per the spec: a copyright claim carries a legal declaration and claimant
 * identity that generic user reports don't, so it isn't just another reason
 * in that modal's dropdown.
 */
export function CopyrightClaimPage() {
  const [searchParams] = useSearchParams()
  const trackId = searchParams.get('trackId') ?? ''
  const goBack = useSmartBack('/app')
  const { firebaseUser } = useAuth()

  const [claimantName, setClaimantName] = useState(firebaseUser?.displayName ?? '')
  const [claimantEmail, setClaimantEmail] = useState(firebaseUser?.email ?? '')
  const [claimantCompany, setClaimantCompany] = useState('')
  const [claimantIsOwnerOrRep, setClaimantIsOwnerOrRep] = useState(false)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [claimedRights, setClaimedRights] = useState('')
  const [supportingLinks, setSupportingLinks] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [declarationSignature, setDeclarationSignature] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [claimId, setClaimId] = useState<string | null>(null)

  const canSubmit =
    trackId &&
    claimantName.trim() &&
    claimantEmail.trim() &&
    claimantIsOwnerOrRep &&
    reason.trim() &&
    declarationSignature.trim() &&
    !submitting

  async function handleSubmit() {
    if (!firebaseUser) {
      setError('Sign in before filing a copyright claim.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const newClaimId = newCopyrightClaimId()

      const evidenceUrls: string[] = []
      for (let i = 0; i < evidenceFiles.length; i++) {
        setUploadStatus(`Uploading evidence ${i + 1} of ${evidenceFiles.length}…`)
        // PDFs pass through as-is — compressImage decodes via <img>/canvas, which can't
        // read a PDF. Images (typically an uncompressed phone screenshot/photo) get resized
        // and re-encoded first, same as every other image upload in the app.
        const file = evidenceFiles[i]
        const uploadFile = file.type.startsWith('image/') ? (await compressImage(file, 'evidence')).file : file
        evidenceUrls.push(await uploadCopyrightEvidence(newClaimId, uploadFile))
      }
      setUploadStatus('')

      await submitCopyrightClaim({
        claimId: newClaimId,
        trackId,
        reason: reason.trim(),
        description: description.trim(),
        claimantName: claimantName.trim(),
        claimantEmail: claimantEmail.trim(),
        claimantCompany: claimantCompany.trim() || undefined,
        claimantIsOwnerOrRep: true,
        claimedRights: claimedRights.trim() || undefined,
        supportingLinks: supportingLinks
          .split('\n')
          .map((link) => link.trim())
          .filter(Boolean),
        evidenceUrls,
        declarationSignature: declarationSignature.trim(),
      })
      setClaimId(newClaimId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your claim.')
    } finally {
      setSubmitting(false)
      setUploadStatus('')
    }
  }

  return (
    <div className="min-h-svh bg-surface-0 text-ink-0">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
          <Link to="/">
            <BrandMark />
          </Link>
          <button onClick={goBack} className="flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink-0 active:opacity-60">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-8 sm:px-8">
        <p className="eyebrow">Copyright</p>
        <h1 className="mt-4 text-4xl font-medium tracking-[-0.04em]">Report copyright infringement</h1>
        <p className="mt-4 text-sm leading-6 text-ink-2">
          Use this form if you are the rights holder (or an authorised representative) and believe a track on
          BackTheVibes infringes your copyright. This is different from a general content report — filing here starts a
          formal review that can result in the track being restricted or removed and its artist's payouts held. See
          our <Link to="/copyright" className="text-brand-400 hover:underline">copyright policy</Link> for details.
        </p>

        {!trackId ? (
          <p className="mt-8 rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
            No track was specified. Open this form from the "Report copyright issue" link on the track you're
            reporting.
          </p>
        ) : claimId ? (
          <div className="mt-8 rounded-xl border border-support-500/30 bg-support-500/10 px-4 py-4 text-sm text-ink-1">
            <p className="font-medium text-ink-0">Claim submitted.</p>
            <p className="mt-1 text-ink-2">
              Reference: <span className="font-mono">{claimId}</span>. Our team will review this claim and may
              contact you at {claimantEmail} for more information.
            </p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Your name</Label>
                <Input value={claimantName} onChange={(e) => setClaimantName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <Label>Your email</Label>
                <Input type="email" value={claimantEmail} onChange={(e) => setClaimantEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <Label>Company or organisation (optional)</Label>
              <Input value={claimantCompany} onChange={(e) => setClaimantCompany(e.target.value)} placeholder="Label, publisher, or agency" />
            </div>
            <div>
              <Label>What rights do you hold? (optional)</Label>
              <Input
                value={claimedRights}
                onChange={(e) => setClaimedRights(e.target.value)}
                placeholder="e.g. Master recording owner, composition owner, exclusive licensee"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Unauthorised use of my master recording" />
            </div>
            <div>
              <Label>Description</Label>
              <TextArea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain what was used without permission and how you identified it." />
            </div>
            <div>
              <Label>Supporting links (optional, one per line)</Label>
              <TextArea rows={3} value={supportingLinks} onChange={(e) => setSupportingLinks(e.target.value)} placeholder="Links to the original release, registration records, etc." />
            </div>
            <div>
              <Label>{`Evidence files (optional, up to ${MAX_EVIDENCE_FILES})`}</Label>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => setEvidenceFiles(Array.from(e.target.files ?? []).slice(0, MAX_EVIDENCE_FILES))}
                className="block w-full text-sm text-ink-2 file:mr-4 file:rounded-full file:border-0 file:bg-white/[0.06] file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink-0 hover:file:bg-white/[0.09]"
              />
              {evidenceFiles.length > 0 ? (
                <p className="mt-1.5 text-xs text-ink-3">{evidenceFiles.length} file(s) selected</p>
              ) : null}
            </div>

            <label className="flex items-start gap-2.5 text-sm text-ink-1">
              <input
                type="checkbox"
                checked={claimantIsOwnerOrRep}
                onChange={(e) => setClaimantIsOwnerOrRep(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              I am the copyright owner, or authorised to act on the owner's behalf, and have a good-faith belief that
              the use described above is not authorised.
            </label>

            <div>
              <Label>Type your full name as a declaration signature</Label>
              <Input
                value={declarationSignature}
                onChange={(e) => setDeclarationSignature(e.target.value)}
                placeholder="Full legal name"
              />
              <p className="mt-1.5 text-xs text-ink-3">
                This is a statement made under penalty of submitting false information, not a cryptographic
                signature.
              </p>
            </div>

            {error ? <p className="text-sm text-danger-500">{error}</p> : null}
            {uploadStatus ? <p className="text-sm text-ink-2">{uploadStatus}</p> : null}

            <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
              Submit claim
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
