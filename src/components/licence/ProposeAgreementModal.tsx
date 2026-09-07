import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { proposeAgreement } from '@/services/licenceService'

export function ProposeAgreementModal({ requestId, onClose, onProposed }: { requestId: string; onClose: () => void; onProposed: () => void }) {
  const [permittedUse, setPermittedUse] = useState('')
  const [territory, setTerritory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [licenceFee, setLicenceFee] = useState('0')
  const [currency, setCurrency] = useState('gbp')
  const [attributionRequirements, setAttributionRequirements] = useState('')
  const [recordingPermission, setRecordingPermission] = useState(true)
  const [streamingPermission, setStreamingPermission] = useState(true)
  const [commercialUse, setCommercialUse] = useState(false)
  const [redistributionAllowed, setRedistributionAllowed] = useState(false)
  const [resaleAllowed, setResaleAllowed] = useState(false)
  const [additionalTerms, setAdditionalTerms] = useState('')
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!authorityConfirmed) {
      setError('Confirm you have authority to grant these rights.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await proposeAgreement({
        requestId,
        permittedUse,
        territory,
        startDate,
        expiryDate: expiryDate || null,
        licenceFeeMinor: Math.round(Number(licenceFee || 0) * 100),
        currency,
        attributionRequirements,
        recordingPermission,
        streamingPermission,
        commercialUse,
        redistributionAllowed,
        resaleAllowed,
        additionalTerms,
      })
      onProposed()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send licence terms.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Propose licence terms" onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="rounded-lg border border-warning-500/30 bg-warning-500/5 px-3 py-2 text-xs text-ink-1">
          This records the agreement between you and the DJ on the platform. Have the final wording
          reviewed professionally before relying on it for a production launch.
        </p>
        <div>
          <Label>Permitted use</Label>
          <Input value={permittedUse} onChange={(e) => setPermittedUse(e.target.value)} placeholder="e.g. Non-commercial DJ sets" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Territory</Label>
            <Input value={territory} onChange={(e) => setTerritory(e.target.value)} placeholder="e.g. Worldwide" />
          </div>
          <div>
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Expiry date (optional)</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div>
            <Label>Licence fee</Label>
            <div className="flex gap-2">
              <Input type="number" min={0} step="0.01" value={licenceFee} onChange={(e) => setLicenceFee(e.target.value)} />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-surface-border bg-surface-2 px-2 text-sm text-ink-0">
                <option value="gbp">GBP</option>
                <option value="usd">USD</option>
                <option value="eur">EUR</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <Label>Attribution requirements</Label>
          <Input value={attributionRequirements} onChange={(e) => setAttributionRequirements(e.target.value)} placeholder="e.g. Credit artist name in set description" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Recording permitted" checked={recordingPermission} onChange={setRecordingPermission} />
          <Toggle label="Streaming permitted" checked={streamingPermission} onChange={setStreamingPermission} />
          <Toggle label="Commercial use" checked={commercialUse} onChange={setCommercialUse} />
          <Toggle label="Redistribution allowed" checked={redistributionAllowed} onChange={setRedistributionAllowed} />
          <Toggle label="Resale allowed" checked={resaleAllowed} onChange={setResaleAllowed} />
        </div>
        <div>
          <Label>Additional terms</Label>
          <TextArea rows={2} value={additionalTerms} onChange={(e) => setAdditionalTerms(e.target.value)} />
        </div>
        <label className="flex items-start gap-2 text-xs text-ink-1">
          <input type="checkbox" checked={authorityConfirmed} onChange={(e) => setAuthorityConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-500" />
          I confirm I have the authority to grant the rights described in these terms.
        </label>
        {error ? <p className="text-sm text-danger-500">{error}</p> : null}
        <Button onClick={handleSubmit} loading={submitting}>
          Send terms to DJ
        </Button>
      </div>
    </Modal>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-2 px-2.5 py-2 text-xs text-ink-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-brand-500" />
      {label}
    </label>
  )
}
