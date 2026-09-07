import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { UserProfile } from '@/types/user'
import type { CopyrightClaimDoc, ReportDoc, VerificationRequestDoc } from '@/types/moderation'
import type { SubscriptionPlan } from '@/types/platformSettings'
import type { PlanFeatureKey, PlanLimitKey, PlanRole, PlanTier } from '@/types/entitlements'

export async function listUsers(count = 50): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, 'users'), limit(count)))
  return snap.docs.map((d) => d.data() as UserProfile)
}

export async function listPendingVerificationRequests(): Promise<VerificationRequestDoc[]> {
  const q = query(collection(db, 'verificationRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as VerificationRequestDoc)
}

export async function listOpenReports(): Promise<ReportDoc[]> {
  const q = query(collection(db, 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as ReportDoc)
}

export async function listCopyrightClaims(): Promise<CopyrightClaimDoc[]> {
  const q = query(collection(db, 'copyrightClaims'), where('status', '==', 'submitted'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as CopyrightClaimDoc)
}

export async function listAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const snap = await getDocs(collection(db, 'subscriptionPlans'))
  return snap.docs.map((d) => d.data() as SubscriptionPlan)
}

export const adminSetUserSuspension = callable<{ userId: string; suspended: boolean }, { ok: boolean }>(
  'adminSetUserSuspension',
)
export const adminSetTrackTakedown = callable<{ trackId: string; takenDown: boolean }, { ok: boolean }>(
  'adminSetTrackTakedown',
)
export const reviewVerificationRequest = callable<{ verificationRequestId: string; approve: boolean }, { ok: boolean }>(
  'reviewVerificationRequest',
)
export const reviewCopyrightClaim = callable<
  { claimId: string; status: string; adminNote?: string },
  { ok: boolean }
>('reviewCopyrightClaim')
export const adminResolveReport = callable<{ reportId: string; status: 'resolved' | 'dismissed' }, { ok: boolean }>(
  'adminResolveReport',
)
export const adminUpsertSubscriptionPlan = callable<
  {
    planId: string
    name: string
    role: PlanRole
    tier: PlanTier
    priceMinor: number
    currency: string
    interval: 'month' | 'year'
    stripePriceId: string | null
    active: boolean
    isDefaultFree: boolean
    features: Partial<Record<PlanFeatureKey, boolean>>
    limits: Partial<Record<PlanLimitKey, number>>
    displayOrder: number
    recommended: boolean
  },
  { ok: boolean }
>('adminUpsertSubscriptionPlan')
export const adminUpdatePlatformSettings = callable<Record<string, unknown>, { ok: boolean }>(
  'adminUpdatePlatformSettings',
)
export const adminSeedSubscriptionPlans = callable<void, { ok: boolean; seeded: string[]; skipped: string[] }>(
  'adminSeedSubscriptionPlans',
)
