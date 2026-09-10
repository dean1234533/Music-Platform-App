import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeUnreadNotificationCount } from '@/services/notificationService'

/** Shared by every surface that shows the notification bell (TopBar, Sidebar) so they all agree. */
export function useUnreadNotificationCount(): number {
  const { firebaseUser } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!firebaseUser) {
      setCount(0)
      return
    }
    return subscribeUnreadNotificationCount(firebaseUser.uid, setCount)
  }, [firebaseUser])

  return count
}
