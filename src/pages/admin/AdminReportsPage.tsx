import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminResolveReport, adminSetLegalHold, listCopyrightClaims, listOpenReports, reviewCopyrightClaim } from '@/services/adminService'
import { getCopyrightEvidenceUrls } from '@/services/moderationService'
import { Button } from '@/components/common/Button'
import { TextArea } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { CopyrightClaimDoc, CopyrightClaimStatus, ReportDoc } from '@/types/moderation'
import type { RestrictedCapability } from '@/types/track'

const RESTRICTABLE_CAPABILITIES: RestrictedCapability[] = ['dj_licensing', 'discovery', 'streaming']
const CAPABILITY_LABEL: Record<RestrictedCapability, string> = {
  dj_licensing: 'DJ licensing',
  discovery: 'Discovery placement',
  streaming: 'Full-length streaming',
}

interface ClaimDraft {
  adminNote: string
  restrictedCapabilities: RestrictedCapability[]
}

export function AdminReportsPage() {
  const [reports, setReports] = useState<ReportDoc[] | null>(null)
  const [claims, setClaims] = useState<CopyrightClaimDoc[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, ClaimDraft>>({})
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string[] | 'loading'>>({})

  async function loadEvidence(claimId: string) {
    setEvidenceUrls((prev) => ({ ...prev, [claimId]: 'loading' }))
    try {
      const { urls } = await getCopyrightEvidenceUrls({ claimId })
      setEvidenceUrls((prev) => ({ ...prev, [claimId]: urls }))
    } catch {
      setEvidenceUrls((prev) => ({ ...prev, [claimId]: [] }))
    }
  }

  useEffect(() => {
    void listOpenReports().then(setReports)
    void listCopyrightClaims().then(setClaims)
  }, [])

  function draftFor(claimId: string): ClaimDraft {
    return drafts[claimId] ?? { adminNote: '', restrictedCapabilities: [] }
  }

  function updateDraft(claimId: string, patch: Partial<ClaimDraft>) {
    setDrafts((prev) => ({ ...prev, [claimId]: { ...draftFor(claimId), ...patch } }))
  }

  function toggleCapability(claimId: string, capability: RestrictedCapability) {
    const draft = draftFor(claimId)
    const next = draft.restrictedCapabilities.includes(capability)
      ? draft.restrictedCapabilities.filter((c) => c !== capability)
      : [...draft.restrictedCapabilities, capability]
    updateDraft(claimId, { restrictedCapabilities: next })
  }

  async function resolveReport(id: string, status: 'resolved' | 'dismissed') {
    setBusyId(id)
    try {
      await adminResolveReport({ reportId: id, status })
      setReports((prev) => prev?.filter((r) => r.reportId !== id) ?? null)
    } finally {
      setBusyId(null)
    }
  }

  // Reported agreement problems are never auto-fixed here — placing a legal
  // hold only freezes the record against automatic retention cleanup and
  // stops voidAgreement from touching it while support investigates; it does
  // not change any term, signature, or payment status. Every hold is
  // audit-logged server-side (adminSetLegalHold -> writeAuditLog).
  async function holdReportedAgreement(id: string, agreementId: string) {
    setBusyId(id)
    try {
      await adminSetLegalHold({ collection: 'licenceAgreements', docId: agreementId, legalHold: true, reason: 'Reported agreement problem under review' })
    } finally {
      setBusyId(null)
    }
  }

  async function applyClaimStatus(claim: CopyrightClaimDoc, status: CopyrightClaimStatus) {
    setBusyId(claim.claimId)
    try {
      const draft = draftFor(claim.claimId)
      await reviewCopyrightClaim({
        claimId: claim.claimId,
        status,
        adminNote: draft.adminNote || undefined,
        restrictedCapabilities: status === 'temporarily_restricted' ? draft.restrictedCapabilities : undefined,
      })
      setClaims((prev) => prev?.map((c) => (c.claimId === claim.claimId ? { ...c, status, adminNote: draft.adminNote || c.adminNote } : c)) ?? null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink-0">Reports & copyright</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Copyright claims</h2>
        {claims === null ? (
          <LoadingState />
        ) : claims.length === 0 ? (
          <EmptyState title="No open copyright claims" />
        ) : (
          <div className="flex flex-col gap-4">
            {claims.map((claim) => {
              const draft = draftFor(claim.claimId)
              const busy = busyId === claim.claimId
              return (
                <div key={claim.claimId} className="flex flex-col gap-3 rounded-xl border border-surface-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink-0">{claim.reason}</p>
                      <p className="text-xs text-ink-2">{claim.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-1">{claim.status}</span>
                  </div>

                  <div className="grid gap-1 text-xs text-ink-2 sm:grid-cols-2">
                    <p>Claimant: {claim.claimantName} ({claim.claimantEmail})</p>
                    {claim.claimantCompany ? <p>Company: {claim.claimantCompany}</p> : null}
                    {claim.claimedRights ? <p>Claimed rights: {claim.claimedRights}</p> : null}
                    <p>Track: {claim.trackId}</p>
                    <p>Artist: {claim.artistId}</p>
                  </div>

                  {claim.supportingLinks && claim.supportingLinks.length > 0 ? (
                    <div className="text-xs text-ink-2">
                      Supporting links:{' '}
                      {claim.supportingLinks.map((link) => (
                        <a key={link} href={link} target="_blank" rel="noreferrer" className="mr-2 text-brand-400 hover:underline">
                          {link}
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {claim.evidenceUrls && claim.evidenceUrls.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {evidenceUrls[claim.claimId] === undefined ? (
                        <Button size="sm" variant="secondary" onClick={() => loadEvidence(claim.claimId)}>
                          Load evidence ({claim.evidenceUrls.length})
                        </Button>
                      ) : evidenceUrls[claim.claimId] === 'loading' ? (
                        <span className="text-xs text-ink-3">Loading evidence…</span>
                      ) : (evidenceUrls[claim.claimId] as string[]).length === 0 ? (
                        <span className="text-xs text-danger-500">Could not load evidence.</span>
                      ) : (
                        (evidenceUrls[claim.claimId] as string[]).map((url, i) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs text-brand-400 hover:underline">
                            View evidence {i + 1}
                          </a>
                        ))
                      )}
                    </div>
                  ) : null}

                  {claim.artistResponse ? (
                    <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-1">Artist response: {claim.artistResponse}</p>
                  ) : null}
                  {claim.counterNoticeText ? (
                    <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-1">Counter-notice: {claim.counterNoticeText}</p>
                  ) : null}

                  <div>
                    <TextArea
                      rows={2}
                      value={draft.adminNote}
                      onChange={(e) => updateDraft(claim.claimId, { adminNote: e.target.value })}
                      placeholder="Admin note (visible to the artist)"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-ink-2">
                    {RESTRICTABLE_CAPABILITIES.map((capability) => (
                      <label key={capability} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={draft.restrictedCapabilities.includes(capability)}
                          onChange={() => toggleCapability(claim.claimId, capability)}
                        />
                        {CAPABILITY_LABEL[capability]}
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => applyClaimStatus(claim, 'under_review')}>
                      Mark under review
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => applyClaimStatus(claim, 'information_required')}>
                      Request more info
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => applyClaimStatus(claim, 'temporarily_restricted')}>
                      Restrict selected
                    </Button>
                    <Button size="sm" variant="danger" loading={busy} onClick={() => applyClaimStatus(claim, 'removed')}>
                      Remove track
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => applyClaimStatus(claim, 'restored')}>
                      Restore
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => applyClaimStatus(claim, 'rejected')}>
                      Reject claim
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => applyClaimStatus(claim, 'resolved')}>
                      Mark resolved
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-0">Reports</h2>
        {reports === null ? (
          <LoadingState />
        ) : reports.length === 0 ? (
          <EmptyState title="No open reports" />
        ) : (
          <div className="flex flex-col divide-y divide-surface-border rounded-xl border border-surface-border">
            {reports.map((report) => (
              <div key={report.reportId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-0">
                    {report.targetType}: {report.reason}
                  </p>
                  <p className="text-xs text-ink-2">{report.description}</p>
                  {report.targetType === 'agreement' ? (
                    <Link to={`/agreements/${report.targetId}`} className="text-xs text-brand-400 hover:underline">
                      View agreement {report.targetId}
                    </Link>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {report.targetType === 'agreement' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === report.reportId}
                      onClick={() => holdReportedAgreement(report.reportId, report.targetId)}
                    >
                      Place legal hold
                    </Button>
                  ) : null}
                  <Button size="sm" loading={busyId === report.reportId} onClick={() => resolveReport(report.reportId, 'resolved')}>
                    Resolve
                  </Button>
                  <Button size="sm" variant="secondary" loading={busyId === report.reportId} onClick={() => resolveReport(report.reportId, 'dismissed')}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
