import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import type { AppUser, UserRole } from '../types/business'
import { AuthContext } from './auth-context'
import { firebaseAuth, firebaseFirestore } from './firebase'

const profileRef = (uid: string) => doc(firebaseFirestore, 'users', uid)
const missingProfileMessage = 'Your account profile is missing. Refresh your account to restore it.'

const authErrorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-disabled': 'This account is disabled. Contact the workshop administrator.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/operation-not-allowed': 'Email and password sign-in is not enabled in Firebase Authentication yet.',
  'auth/unauthorized-domain': 'Add this website domain to the authorized domains in Firebase Authentication.',
  'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
  'auth/invalid-api-key': 'Firebase rejected the web app configuration. Check the values in .env.local.',
}

function friendlyAuthError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : ''
  return new Error(authErrorMessages[code] ?? 'Firebase Authentication could not complete that request. Check your setup and try again.')
}

function accountAccessError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : ''
  if (code === 'permission-denied') return 'Firestore denied account access. Deploy the project security rules and refresh your account.'
  if (code === 'unavailable' || code === 'auth/network-request-failed') return 'Account access is temporarily unavailable. Check your connection and refresh your account.'
  return 'Could not load your account profile and role from Firestore. Refresh your account or contact an administrator.'
}

function baseUser(firebaseUser: FirebaseUser): AppUser {
  return {
    id: firebaseUser.uid,
    name: (firebaseUser.displayName?.trim() || firebaseUser.email?.split('@')[0] || 'Customer').slice(0, 80),
    email: firebaseUser.email ?? '',
    emailVerified: firebaseUser.emailVerified,
    adminVerificationRequired: false,
    role: 'user',
  }
}

function withRole(account: AppUser, role: UserRole): AppUser {
  return {
    ...account,
    role: role === 'admin' && account.emailVerified ? 'admin' : 'user',
    adminVerificationRequired: role === 'admin' && !account.emailVerified,
  }
}

async function syncProfile(firebaseUser: FirebaseUser, account: AppUser) {
  const ref = profileRef(firebaseUser.uid)
  return runTransaction(firebaseFirestore, async transaction => {
    const existing = await transaction.get(ref)
    if (!existing.exists()) {
      transaction.set(ref, { name: account.name, email: account.email, role: 'user', createdAt: serverTimestamp() })
      return 'user' as UserRole
    }
    const profile = existing.data()
    const updates: Record<string, string> = {}
    if (profile.name !== account.name) updates.name = account.name
    if (profile.email !== account.email) updates.email = account.email
    // Give older profiles a user role without changing an existing admin role.
    if (!Object.hasOwn(profile, 'role')) updates.role = 'user'
    if (Object.keys(updates).length) transaction.update(ref, updates)
    return profile.role === 'admin' ? 'admin' as UserRole : 'user' as UserRole
  })
}

async function resolveAccount(firebaseUser: FirebaseUser): Promise<{ account: AppUser; error: string }> {
  try {
    await reload(firebaseUser)
    await firebaseUser.getIdToken(true)
  } catch (error) {
    return { account: baseUser(firebaseUser), error: accountAccessError(error) }
  }
  const account = baseUser(firebaseUser)
  try {
    const role = await syncProfile(firebaseUser, account)
    return { account: withRole(account, role), error: '' }
  } catch (error) {
    return { account, error: accountAccessError(error) }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountError, setAccountError] = useState('')
  const registrationWarning = useRef('')

  useEffect(() => {
    let active = true
    let generation = 0
    const unsubscribe = onAuthStateChanged(firebaseAuth, async firebaseUser => {
      const currentGeneration = ++generation
      if (!firebaseUser) {
        if (active) {
          setUser(null)
          registrationWarning.current = ''
          setAccountError('')
          setLoading(false)
        }
        return
      }

      let resolved: { account: AppUser; error: string }
      try {
        resolved = await resolveAccount(firebaseUser)
      } catch (error) {
        resolved = { account: baseUser(firebaseUser), error: accountAccessError(error) }
      }
      if (!active || currentGeneration !== generation) return
      setUser(resolved.account)
      setAccountError(resolved.error || registrationWarning.current)
      setLoading(false)
    }, error => {
      if (active) {
        setUser(null)
        setAccountError(accountAccessError(error))
        setLoading(false)
      }
    })

    return () => {
      active = false
      generation += 1
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const uid = user.id
    return onSnapshot(profileRef(uid), { includeMetadataChanges: true }, snapshot => {
      // resolveAccount already read the role from the server. Ignore the listener's
      // initial cache event so refreshing an admin page does not redirect it.
      if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) return
      const isAdmin = snapshot.exists() && snapshot.data().role === 'admin'
      setUser(current => {
        if (current?.id !== uid) return current
        const next = withRole(current, isAdmin ? 'admin' : 'user')
        return current.role === next.role && current.adminVerificationRequired === next.adminVerificationRequired ? current : next
      })
      setAccountError(current => !snapshot.exists() ? missingProfileMessage : current === missingProfileMessage ? '' : current)
    }, error => {
      setUser(current => current?.id === uid ? withRole(current, 'user') : current)
      setAccountError(accountAccessError(error))
    })
  }, [user?.id, user?.emailVerified])

  const refreshAccount = async () => {
    const firebaseUser = firebaseAuth.currentUser
    if (!firebaseUser) throw new Error('Sign in again to refresh your account.')
    let resolved: { account: AppUser; error: string }
    try {
      resolved = await resolveAccount(firebaseUser)
    } catch (error) {
      throw friendlyAuthError(error)
    }
    setUser(resolved.account)
    registrationWarning.current = ''
    setAccountError(resolved.error)
    if (resolved.error) throw new Error(resolved.error)
    return resolved.account
  }

  const signIn = async (email: string, password: string) => {
    if (!email.trim() || !password) throw new Error('Enter your email address and password.')
    let firebaseUser: FirebaseUser
    try {
      await setPersistence(firebaseAuth, browserLocalPersistence)
      firebaseUser = (await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)).user
    } catch (error) {
      throw friendlyAuthError(error)
    }
    const resolved = await resolveAccount(firebaseUser)
    setUser(resolved.account)
    registrationWarning.current = ''
    setAccountError(resolved.error)
    return resolved.account
  }

  const register = async (name: string, email: string, password: string) => {
    if (!name.trim() || name.trim().length > 80 || !email.trim() || password.length < 6) {
      throw new Error('Enter a name up to 80 characters, a valid email, and a password with at least 6 characters.')
    }
    let firebaseUser: FirebaseUser
    try {
      await setPersistence(firebaseAuth, browserLocalPersistence)
      firebaseUser = (await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)).user
    } catch (error) {
      throw friendlyAuthError(error)
    }
    const warnings: string[] = []
    try {
      await updateFirebaseProfile(firebaseUser, { displayName: name.trim() })
    } catch {
      warnings.push('Account created, but your display name could not be saved. You can update it in Settings.')
    }
    try {
      await syncProfile(firebaseUser, { ...baseUser(firebaseUser), name: name.trim() })
    } catch {
      warnings.push('Your profile could not be saved to Firestore. Refresh your account to retry.')
    }
    const nextUser = baseUser(firebaseUser)
    const warning = warnings.join(' ')
    registrationWarning.current = warning
    setUser(nextUser)
    setAccountError(warning)
    return nextUser
  }

  const resendVerificationEmail = async () => {
    const firebaseUser = firebaseAuth.currentUser
    if (!firebaseUser) throw new Error('Sign in again before requesting a verification email.')
    if (firebaseUser.emailVerified) throw new Error('This email address is already verified.')
    try {
      await sendEmailVerification(firebaseUser)
    } catch (error) {
      throw friendlyAuthError(error)
    }
  }

  const updateProfile = async (name: string) => {
    const firebaseUser = firebaseAuth.currentUser
    if (!firebaseUser) throw new Error('Your sign-in session has expired. Sign in again and retry.')
    try {
      await updateFirebaseProfile(firebaseUser, { displayName: name.trim() })
    } catch (error) {
      throw friendlyAuthError(error)
    }
    const resolved = await resolveAccount(firebaseUser)
    setUser(resolved.account)
    registrationWarning.current = ''
    setAccountError(resolved.error)
    if (resolved.error) throw new Error(resolved.error)
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(firebaseAuth)
      setUser(null)
      registrationWarning.current = ''
      setAccountError('')
    } catch (error) {
      throw friendlyAuthError(error)
    }
  }

  return <AuthContext.Provider value={{ user, loading, accountError, signIn, register, refreshAccount, resendVerificationEmail, updateProfile, signOut }}>{children}</AuthContext.Provider>
}
