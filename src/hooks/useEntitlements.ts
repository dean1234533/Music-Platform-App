import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'

export function useCanAccessSupporterContent(artistId: string | null): boolean {
  const { firebaseUser } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    setHasAccess(false)
    if (!firebaseUser || !artistId) return
    const unsubscribe = onSnapshot(doc(db, 'supportRelationships', `${firebaseUser.uid}_${artistId}`), (snap) => {
      setHasAccess(snap.exists())
    })
    return unsubscribe
  }, [firebaseUser, artistId])

  return hasAccess
}
