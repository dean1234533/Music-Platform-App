import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const sizeClasses = {
  sm: 'text-sm px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-6 py-3.5 rounded-xl gap-2',
} as const

/**
 * Routes to the Subscription page, where checkout and artist allocation live.
 * When a specific artistId is known (clicked from that artist's own profile/track
 * page), carries it through as ?artist=<id> so the subscription flow can follow +
 * pre-select that artist for allocation once the fan is an active supporter,
 * rather than landing on a generic page with no memory of which artist they meant.
 */
export function SupportButton({ artistId, size = 'md' }: { artistId?: string; size?: keyof typeof sizeClasses }) {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()

  const subscriptionPath = artistId ? `/app/subscription?artist=${encodeURIComponent(artistId)}` : '/app/subscription'

  function handleClick() {
    if (!firebaseUser) {
      navigate(`/sign-in?returnTo=${encodeURIComponent(subscriptionPath)}`)
      return
    }
    navigate(subscriptionPath)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center font-medium bg-support-500 text-white hover:bg-support-400 shadow-lg shadow-support-500/20 transition-colors duration-150 ${sizeClasses[size]}`}
    >
      <Heart className="h-4 w-4" />
      Support
    </button>
  )
}
