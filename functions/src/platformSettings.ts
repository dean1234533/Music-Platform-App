import { db } from './admin.js'

export interface PlatformSettings {
  platformFeePercent: number
  artistAllocationPercent: number
  djServiceFeePercent: number
  minimumPayoutMinor: number
}

export interface DataRetentionSettings {
  notificationsDays: number
  storyRecoveryDays: number
  inactiveChatMonths: number
  abandonedRequestMonths: number
  draftOfferMonths: number
  auditLogMonths: number
  contractYears: number
  copyrightClaimYears: number
}

/**
 * Suggested defaults from the spec — used until an admin configures real
 * values, so cleanup jobs always have something sane to run against rather
 * than needing a one-time seed before they function at all. Not legal
 * advice: flagged for solicitor/accountant review before production launch
 * (see the Privacy page's retention section).
 */
export const DEFAULT_DATA_RETENTION: DataRetentionSettings = {
  notificationsDays: 90,
  storyRecoveryDays: 7,
  inactiveChatMonths: 24,
  abandonedRequestMonths: 12,
  draftOfferMonths: 12,
  auditLogMonths: 24,
  contractYears: 6,
  copyrightClaimYears: 6,
}

export async function getDataRetentionSettings(): Promise<DataRetentionSettings> {
  const snap = await db.collection('platformSettings').doc('dataRetention').get()
  if (!snap.exists) return DEFAULT_DATA_RETENTION
  const data = snap.data() ?? {}
  const merged = { ...DEFAULT_DATA_RETENTION }
  for (const key of Object.keys(DEFAULT_DATA_RETENTION) as (keyof DataRetentionSettings)[]) {
    if (typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] > 0) {
      merged[key] = data[key]
    }
  }
  return merged
}

/**
 * Placeholder revenue-split defaults — used until an admin sets real values via Admin ->
 * Settings, same pattern as DEFAULT_DATA_RETENTION, so billing works out of the box instead
 * of hard-failing on a doc nobody has touched yet (user-reported: "no this should auto set").
 * Not a considered business decision: review and adjust in Admin -> Settings before relying
 * on these for real payouts.
 */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformFeePercent: 15,
  artistAllocationPercent: 85,
  djServiceFeePercent: 10,
  minimumPayoutMinor: 2000,
}

/** Single source of truth for every revenue split. Falls back to DEFAULT_PLATFORM_SETTINGS until an admin configures real values. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const snap = await db.collection('platformSettings').doc('default').get()
  if (!snap.exists) return DEFAULT_PLATFORM_SETTINGS
  const data = snap.data() ?? {}
  const settings = {
    platformFeePercent: data.platformFeePercent,
    artistAllocationPercent: data.artistAllocationPercent,
    djServiceFeePercent: data.djServiceFeePercent,
    minimumPayoutMinor: data.minimumPayoutMinor,
  }
  // A doc that exists but is only partially filled in (an admin mid-edit, or a stray write)
  // still fails loudly rather than silently mixing saved and default values — the fallback
  // above is only for "never configured at all".
  if (Object.values(settings).some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('platformSettings/default contains missing or invalid payment settings.')
  }
  if (settings.platformFeePercent + settings.artistAllocationPercent !== 100) {
    throw new Error('Fan revenue platform and artist percentages must total 100.')
  }
  return settings as PlatformSettings
}
