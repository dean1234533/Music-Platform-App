import { useEffect, useState } from 'react'
import { collection, doc, getDocs, onSnapshot, query, where, type Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import type { SubscriptionPlan } from '@/types/platformSettings'
import type { SubscriptionDoc } from '@/types/subscription'
import { UNLIMITED, type PlanFeatureKey, type PlanLimitKey, type PlanRole, type ResolvedSubscriptionStatus } from '@/types/entitlements'

/** Same coarse mapping as functions/src/entitlements.ts's mapSubscriptionStatus — duplicated, see that file's comment. */
function coarseStatus(raw: string): 'active' | 'past_due' | 'canceled' | 'none' {
  switch (raw) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
    case 'paused':
      return 'canceled'
    default:
      return 'none'
  }
}

const plansCache = new Map<PlanRole, Promise<SubscriptionPlan[]>>()

function loadPlansForRole(role: PlanRole): Promise<SubscriptionPlan[]> {
  let pending = plansCache.get(role)
  if (!pending) {
    pending = getDocs(query(collection(db, 'subscriptionPlans'), where('role', '==', role))).then((snap) =>
      snap.docs.map((d) => d.data() as SubscriptionPlan),
    )
    plansCache.set(role, pending)
  }
  return pending
}

export interface EntitlementState {
  plan: SubscriptionPlan | null
  status: ResolvedSubscriptionStatus | 'loading'
  hasFeature: (key: PlanFeatureKey) => boolean
  getLimit: (key: PlanLimitKey) => number
}

/**
 * UI convenience only — mirrors the server-side resolver in
 * functions/src/entitlements.ts (resolveEffectivePlan) for responsive UI,
 * but this hook's answer is never the real gate. Every paid feature must
 * also be enforced server-side (Firestore rules or a callable) — a user
 * could always be running modified client code.
 */
export function useEntitlement(role: PlanRole): EntitlementState {
  const { firebaseUser } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)
  const [sub, setSub] = useState<SubscriptionDoc | null>(null)
  const [subLoaded, setSubLoaded] = useState(false)

  useEffect(() => {
    setPlans(null)
    let cancelled = false
    loadPlansForRole(role).then((result) => {
      if (!cancelled) setPlans(result)
    })
    return () => {
      cancelled = true
    }
  }, [role])

  useEffect(() => {
    setSub(null)
    setSubLoaded(false)
    if (!firebaseUser) {
      setSubLoaded(true)
      return
    }
    const ref = doc(db, 'subscriptions', `${firebaseUser.uid}_${role}`)
    const unsubscribe = onSnapshot(ref, (snap) => {
      setSub(snap.exists() ? (snap.data() as SubscriptionDoc) : null)
      setSubLoaded(true)
    })
    return unsubscribe
  }, [firebaseUser, role])

  if (!plans || !subLoaded) {
    return { plan: null, status: 'loading', hasFeature: () => false, getLimit: () => 0 }
  }

  let plan: SubscriptionPlan | null = null
  let status: ResolvedSubscriptionStatus = 'free'
  if (sub) {
    const coarse = coarseStatus(sub.status)
    if (coarse === 'active' || coarse === 'past_due') {
      const matched = plans.find((p) => p.planId === sub.planId && p.active)
      if (matched) {
        plan = matched
        status = coarse
      }
    }
  }
  if (!plan) {
    plan = plans.find((p) => p.isDefaultFree) ?? null
    status = 'free'
  }

  const resolvedPlan = plan
  return {
    plan: resolvedPlan,
    status,
    hasFeature: (key) => resolvedPlan?.features?.[key] === true,
    getLimit: (key) => resolvedPlan?.limits?.[key] ?? 0,
  }
}

export function useCanUploadTrack(): { allowed: boolean; trackCount: number; trackLimit: number; loading: boolean } {
  const { firebaseUser } = useAuth()
  const [state, setState] = useState<{ trackCount: number; trackLimit: number } | null>(null)

  useEffect(() => {
    setState(null)
    if (!firebaseUser) return
    const unsubscribe = onSnapshot(doc(db, 'artistProfiles', firebaseUser.uid), (snap) => {
      const data = snap.data()
      setState({ trackCount: (data?.trackCount as number) ?? 0, trackLimit: (data?.trackLimit as number) ?? 0 })
    })
    return unsubscribe
  }, [firebaseUser])

  if (!state) return { allowed: true, trackCount: 0, trackLimit: 0, loading: true }
  const allowed = state.trackLimit === UNLIMITED || state.trackCount < state.trackLimit
  return { allowed, ...state, loading: false }
}

function isSameCalendarMonth(ts: Timestamp | null, now = new Date()): boolean {
  if (!ts) return false
  const d = ts.toDate()
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
}

export function useCanRequestDjLicence(): { allowed: boolean; remaining: number; loading: boolean } {
  const { firebaseUser } = useAuth()
  const { status, getLimit } = useEntitlement('dj')
  const [profile, setProfile] = useState<{ requestsThisMonth: number; requestsMonthResetAt: Timestamp | null } | null>(null)

  useEffect(() => {
    setProfile(null)
    if (!firebaseUser) return
    const unsubscribe = onSnapshot(doc(db, 'djProfiles', firebaseUser.uid), (snap) => {
      const data = snap.data()
      setProfile({
        requestsThisMonth: (data?.requestsThisMonth as number) ?? 0,
        requestsMonthResetAt: (data?.requestsMonthResetAt as Timestamp | null) ?? null,
      })
    })
    return unsubscribe
  }, [firebaseUser])

  if (status === 'loading' || !profile) return { allowed: true, remaining: 0, loading: true }
  const limit = getLimit('djRequestsPerMonth')
  if (limit === UNLIMITED) return { allowed: true, remaining: UNLIMITED, loading: false }
  const effectiveCount = isSameCalendarMonth(profile.requestsMonthResetAt) ? profile.requestsThisMonth : 0
  const remaining = Math.max(0, limit - effectiveCount)
  return { allowed: remaining > 0, remaining, loading: false }
}

export function useCanAccessSupporterContent(artistId: string | null): boolean {
  const { firebaseUser } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    setHasAccess(false)
    if (!firebaseUser || !artistId) return
    const unsubscribe = onSnapshot(doc(db, 'supportRelationships', `${firebaseUser.uid}_${artistId}`), (snap) => {
      setHasAccess(snap.exists())
    })
    return unsubscribe
  }, [firebaseUser, artistId])

  return hasAccess
}
