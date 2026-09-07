import { useEffect, useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { followArtist, subscribeIsFollowing, unfollowArtist } from '@/services/followService'
import { Button } from '@/components/common/Button'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'

export function FollowButton({ artistId, size = 'md' }: { artistId: string; size?: 'sm' | 'md' | 'lg' }) {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
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

  async function handleClick() {
    if (!firebaseUser) {
      navigate('/sign-in')
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
