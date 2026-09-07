import { db } from './admin.js'

export interface PlatformSettings {
  platformFeePercent: number
  artistAllocationPercent: number
  djServiceFeePercent: number
  minimumPayoutMinor: number
}

const DEFAULTS: PlatformSettings = {
  platformFeePercent: 15,
  artistAllocationPercent: 85,
  djServiceFeePercent: 10,
  minimumPayoutMinor: 2000,
}

/**
 * Single admin-configured document (`platformSettings/default`). Falls back
 * to sane defaults if an admin hasn't published settings yet, so revenue
 * calculations never crash — but the *values* actually used always come
 * from here, never a hard-coded constant scattered through the codebase.
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const snap = await db.collection('platformSettings').doc('default').get()
  if (!snap.exists) return DEFAULTS
  const data = snap.data() ?? {}
  return { ...DEFAULTS, ...data }
}
