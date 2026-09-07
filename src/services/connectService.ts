import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callable } from '@/lib/callable'
import type { ArtistPayoutAccountDoc } from '@/types/finance'

const startOnboarding = callable<{ returnUrl: string; refreshUrl: string }, { url: string }>('createConnectOnboardingLink')
const startDashboard = callable<void, { url: string }>('createConnectDashboardLink')

export async function beginConnectOnboarding(): Promise<void> {
  const origin = window.location.origin
  const { url } = await startOnboarding({
    returnUrl: `${origin}/dashboard/artist/revenue?connect=return`,
    refreshUrl: `${origin}/dashboard/artist/revenue?connect=refresh`,
  })
  window.location.href = url
}

export async function openConnectDashboard(): Promise<void> {
  const { url } = await startDashboard()
  window.location.href = url
}

export function subscribeArtistPayoutAccount(artistId: string, onChange: (account: ArtistPayoutAccountDoc | null) => void) {
  return onSnapshot(doc(db, 'artistPayoutAccounts', artistId), (snap) => {
    onChange(snap.exists() ? (snap.data() as ArtistPayoutAccountDoc) : null)
  })
}
