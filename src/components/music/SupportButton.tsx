import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useArtistSummary } from '@/hooks/useArtistSummary'
import { SupportModal } from '@/components/music/SupportModal'

const sizeClasses = {
  sm: 'text-sm px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-6 py-3.5 rounded-xl gap-2',
} as const

/**
 * Opens the one-off support amount picker (SupportModal), which goes
 * straight to Stripe Checkout for a direct payment to this artist — there
 * is no subscription or platform-wide plan to pick.
 */
export function SupportButton({ artistId, size = 'md' }: { artistId?: string; size?: keyof typeof sizeClasses }) {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const artist = useArtistSummary(artistId ?? null)
  const [showModal, setShowModal] = useState(false)

  function handleClick() {
    if (!firebaseUser) {
      navigate(`/sign-in?returnTo=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    if (!artistId) {
      navigate('/app/subscription')
      return
    }
    setShowModal(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center font-medium bg-support-500 text-white hover:bg-support-400 shadow-lg shadow-support-500/20 transition-colors duration-150 ${sizeClasses[size]}`}
      >
        <Heart className="h-4 w-4" />
        Support
      </button>
      {showModal && artistId ? (
        <SupportModal artistId={artistId} artistName={artist?.name ?? 'this artist'} onClose={() => setShowModal(false)} />
      ) : null}
    </>
  )
}
