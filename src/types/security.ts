import type { Timestamp } from 'firebase/firestore'

export interface SecurityIncidentAction {
  note: string
  at: string
  by: string
}

export interface SecurityIncidentDoc {
  incidentId: string
  detectedAt: Timestamp | null
  incidentType: string
  affectedSystems: string[]
  affectedDataCategories: string[]
  estimatedUsersAffected: number | null
  riskAssessment: string
  actionsTaken: SecurityIncidentAction[]
  containedAt: Timestamp | null
  resolvedAt: Timestamp | null
  notificationDecision: string
  notes: string
  createdBy: string
  updatedAt: Timestamp | null
}
