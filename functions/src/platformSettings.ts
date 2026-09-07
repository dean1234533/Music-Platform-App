import { db } from './admin.js'

export interface PlatformSettings {
  platformFeePercent: number
  artistAllocationPercent: number
  djServiceFeePercent: number
  minimumPayoutMinor: number
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
