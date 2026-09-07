import { useEffect, useState } from 'react'
import { adminCreateSecurityIncident, adminUpdateSecurityIncident, listSecurityIncidents } from '@/services/adminService'
import { Button } from '@/components/common/Button'
import { Input, Label, TextArea } from '@/components/common/Input'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import type { SecurityIncidentDoc } from '@/types/security'

const EMPTY_FORM = { incidentType: '', riskAssessment: '', notes: '' }

/**
 * Internal breach register — see SECURITY_INCIDENT_RESPONSE.md for the
 * workflow this supports. Deliberately manual: an admin records what
 * happened and what was decided, this doesn't detect or classify anything
 * automatically.
 */
export function AdminSecurityIncidentsPage() {
  const [incidents, setIncidents] = useState<SecurityIncidentDoc[] | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [savingNote, setSavingNote] = useState<string | null>(null)

  async function refresh() {
    setIncidents(await listSecurityIncidents())
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleCreate() {
    if (!form.incidentType.trim()) return
    setCreating(true)
    try {
      await adminCreateSecurityIncident(form)
      setForm(EMPTY_FORM)
      await refresh()
    } finally {
      setCreating(false)
    }
  }

  async function handleAddNote(incidentId: string) {
    const actionTaken = noteDrafts[incidentId]?.trim()
    if (!actionTaken) return
    setSavingNote(incidentId)
    try {
      await adminUpdateSecurityIncident({ incidentId, actionTaken })
      setNoteDrafts((d) => ({ ...d, [incidentId]: '' }))
      await refresh()
    } finally {
      setSavingNote(null)
    }
  }

  async function handleMarkContained(incidentId: string) {
    await adminUpdateSecurityIncident({ incidentId, containedAt: true })
    await refresh()
  }

  async function handleMarkResolved(incidentId: string) {
    await adminUpdateSecurityIncident({ incidentId, resolvedAt: true })
    await refresh()
  }

  if (incidents === null) return <LoadingState />

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-ink-0">Security incidents</h1>

      <section className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-1 p-4">
        <h2 className="text-sm font-semibold text-ink-0">Log a new incident</h2>
        <div>
          <Label>Incident type</Label>
          <Input
            value={form.incidentType}
            onChange={(e) => setForm((f) => ({ ...f, incidentType: e.target.value }))}
            placeholder="e.g. exposed API key, suspicious admin action, data exposure"
          />
        </div>
        <div>
          <Label>Initial risk assessment</Label>
          <TextArea rows={2} value={form.riskAssessment} onChange={(e) => setForm((f) => ({ ...f, riskAssessment: e.target.value }))} />
        </div>
        <div>
          <Label>Notes</Label>
          <TextArea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div>
          <Button size="sm" onClick={handleCreate} loading={creating} disabled={!form.incidentType.trim()}>
            Log incident
          </Button>
        </div>
      </section>

      {incidents.length === 0 ? (
        <EmptyState title="No incidents recorded" />
      ) : (
        <div className="flex flex-col gap-4">
          {incidents.map((incident) => (
            <div key={incident.incidentId} className="rounded-xl border border-surface-border bg-surface-1 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink-0">{incident.incidentType}</p>
                <span className="text-xs text-ink-3">
                  {incident.resolvedAt ? 'Resolved' : incident.containedAt ? 'Contained' : 'Open'}
                </span>
              </div>
              {incident.riskAssessment ? <p className="mt-1 text-sm text-ink-2">{incident.riskAssessment}</p> : null}
              {incident.actionsTaken.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-3">
                  {incident.actionsTaken.map((a, i) => (
                    <li key={i}>
                      {new Date(a.at).toLocaleString()} — {a.note}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Add an action/note"
                  value={noteDrafts[incident.incidentId] ?? ''}
                  onChange={(e) => setNoteDrafts((d) => ({ ...d, [incident.incidentId]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleAddNote(incident.incidentId)}
                  loading={savingNote === incident.incidentId}
                >
                  Add
                </Button>
                {!incident.containedAt ? (
                  <Button size="sm" variant="secondary" onClick={() => handleMarkContained(incident.incidentId)}>
                    Mark contained
                  </Button>
                ) : null}
                {!incident.resolvedAt ? (
                  <Button size="sm" variant="secondary" onClick={() => handleMarkResolved(incident.incidentId)}>
                    Mark resolved
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
