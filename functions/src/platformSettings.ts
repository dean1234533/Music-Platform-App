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

/** Single source of truth for every revenue split. Billing stops safely if it is not configured. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const snap = await db.collection('platformSettings').doc('default').get()
  if (!snap.exists) throw new Error('platformSettings/default must be configured before payments can be processed.')
  const data = snap.data() ?? {}
  const settings = {
    platformFeePercent: data.platformFeePercent,
    artistAllocationPercent: data.artistAllocationPercent,
    djServiceFeePercent: data.djServiceFeePercent,
    minimumPayoutMinor: data.minimumPayoutMinor,
  }
  if (Object.values(settings).some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('platformSettings/default contains missing or invalid payment settings.')
  }
  if (settings.platformFeePercent + settings.artistAllocationPercent !== 100) {
    throw new Error('Fan revenue platform and artist percentages must total 100.')
  }
  return settings as PlatformSettings
}
