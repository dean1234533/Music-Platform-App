import { useEffect, useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { followArtist, subscribeIsFollowing, unfollowArtist } from '@/services/followService'
import { Button } from '@/components/common/Button'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'

const PENDING_FOLLOW_KEY = 'pendingFollowArtistId'

export function FollowButton({ artistId, size = 'md' }: { artistId: string; size?: 'sm' | 'md' | 'lg' }) {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useToast()
  const [isFollowing, setIsFollowing] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!firebaseUser) {
      setIsFollowing(false)
      return
    }
    return subscribeIsFollowing(firebaseUser.uid, artistId, setIsFollowing)
  }, [firebaseUser, artistId])

  // Resumes a Follow that was interrupted by a sign-in/sign-up detour — a logged-out visitor
  // clicking Follow shouldn't have to click it a second time once they're back here signed in.
  useEffect(() => {
    if (!firebaseUser) return
    if (sessionStorage.getItem(PENDING_FOLLOW_KEY) !== artistId) return
    sessionStorage.removeItem(PENDING_FOLLOW_KEY)
    void followArtist(firebaseUser.uid, artistId)
      .then(() => {
        setIsFollowing(true)
        notify('Artist added to Following.')
      })
      .catch(() => notify('Could not update Following. Please try again.', 'error'))
  }, [firebaseUser, artistId, notify])

  async function handleClick() {
    if (!firebaseUser) {
      sessionStorage.setItem(PENDING_FOLLOW_KEY, artistId)
      const returnTo = `${location.pathname}${location.search}`
      navigate(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`, { state: { from: location } })
      return
    }
    setPending(true)
    try {
      if (isFollowing) {
        await unfollowArtist(firebaseUser.uid, artistId)
        notify('Artist removed from Following.', 'info')
      } else {
        await followArtist(firebaseUser.uid, artistId)
        notify('Artist added to Following.')
      }
    } catch {
      notify('Could not update Following. Please try again.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant={isFollowing ? 'secondary' : 'primary'}
      size={size}
      loading={pending}
      onClick={handleClick}
    >
      {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  )
}
