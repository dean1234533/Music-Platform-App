import { onAuthStateChanged, type User } from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth } from '@/lib/firebase'
import { ensureUserDocument, subscribeToUserProfile } from '@/services/userService'
import type { UserProfile, UserRole } from '@/types/user'

interface AuthContextValue {
  firebaseUser: User | null
  profile: UserProfile | null
  initializing: boolean
  hasRole: (role: UserRole) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      if (!user) {
        setProfile(null)
        setInitializing(false)
        return
      }
      try {
        await ensureUserDocument(user)
      } catch (error) {
        console.error('Could not initialise the user profile.', error)
        setProfile(null)
        setInitializing(false)
      }
    })
    return unsubscribeAuth
  }, [])

  useEffect(() => {
    if (!firebaseUser) return
    const unsubscribeProfile = subscribeToUserProfile(firebaseUser.uid, (nextProfile) => {
      setProfile(nextProfile)
      setInitializing(false)
    })
    return unsubscribeProfile
  }, [firebaseUser])

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      initializing,
      hasRole: (role) => profile?.roles.includes(role) ?? false,
    }),
    [firebaseUser, profile, initializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
