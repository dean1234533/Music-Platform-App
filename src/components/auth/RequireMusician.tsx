import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { LoadingState } from '@/components/common/StateViews'

/** Blocks direct navigation to a track-upload/DJ-licensing page for a dancer creatorType — the nav already hides the link, this covers a typed-in URL. */
export function RequireMusician({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth()
  const artist = useArtistSummary(firebaseUser?.uid ?? null)

  if (artist === null) return <LoadingState />
  if (artist.creatorType === 'dancer') return <Navigate to="/dashboard/artist" replace />

  return <>{children}</>
}
