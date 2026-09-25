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
import { doc, getDocFromServer, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import type { AppUser } from '../types/business'
import { isCompanyAdminEmail } from './adminAccess'
import { AuthContext } from './auth-context'
import { firebaseAuth, firebaseFirestore } from './firebase'

const adminAccountRef = doc(firebaseFirestore, 'config', 'adminAccount')
const adminSetupMessage = 'This company account is not linked as the admin yet. Set config/adminAccount to its Firebase UID in Firestore.'

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
  return 'Could not load your account profile and admin access from Firestore. Refresh your account or contact the company admin.'
}

function baseUser(firebaseUser: FirebaseUser): AppUser {
  return {
    id: firebaseUser.uid,
    name: (firebaseUser.displayName?.trim() || firebaseUser.email?.split('@')[0] || 'Customer').slice(0, 80),
    email: firebaseUser.email ?? '',
    emailVerified: firebaseUser.emailVerified,
    role: 'user',
  }
}

async function syncVerifiedProfile(firebaseUser: FirebaseUser, account: AppUser) {
  const profileRef = doc(firebaseFirestore, 'users', firebaseUser.uid)
  await runTransaction(firebaseFirestore, async transaction => {
    const existing = await transaction.get(profileRef)
    if (!existing.exists()) {
      transaction.set(profileRef, { name: account.name, email: account.email, createdAt: serverTimestamp() })
    } else if (existing.data().name !== account.name || existing.data().email !== account.email) {
      transaction.update(profileRef, { name: account.name, email: account.email })
    }
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
  if (!account.emailVerified) return { account, error: '' }

  try {
    await syncVerifiedProfile(firebaseUser, account)
    if (isCompanyAdminEmail(account.email)) {
      const adminAccount = await getDocFromServer(adminAccountRef)
      if (!adminAccount.exists() || adminAccount.data().uid !== account.id) {
        return { account, error: adminSetupMessage }
      }
      account.role = 'admin'
    }
    return { account, error: '' }
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
    if (!user?.id || !user.emailVerified || !isCompanyAdminEmail(user.email)) return
    const uid = user.id
    return onSnapshot(adminAccountRef, { includeMetadataChanges: true }, snapshot => {
      // Local writes have not passed the server's rules yet; only trust a confirmed admin UID.
      if (snapshot.metadata.hasPendingWrites) return
      const isAdmin = !snapshot.metadata.fromCache && snapshot.exists() && snapshot.data().uid === uid
      setUser(current => current?.id === uid && current.role !== (isAdmin ? 'admin' : 'user')
        ? { ...current, role: isAdmin ? 'admin' : 'user' }
        : current)
      if (!snapshot.metadata.fromCache) {
        setAccountError(current => isAdmin && current === adminSetupMessage ? '' : !isAdmin ? adminSetupMessage : current)
      }
    }, error => {
      setUser(current => current?.id === uid ? { ...current, role: 'user' } : current)
      setAccountError(accountAccessError(error))
    })
  }, [user?.id, user?.email, user?.emailVerified])

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
    if (isCompanyAdminEmail(email)) {
      throw new Error('This email is reserved for the company admin. Sign in or contact the business.')
    }
    let firebaseUser: FirebaseUser
    try {
      await setPersistence(firebaseAuth, browserLocalPersistence)
      firebaseUser = (await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)).user
    } catch (error) {
      throw friendlyAuthError(error)
    }
    let warning = ''
    try {
      await updateFirebaseProfile(firebaseUser, { displayName: name.trim() })
    } catch {
      warning = 'Account created, but your display name could not be saved. You can update it in Settings.'
    }
    try {
      await sendEmailVerification(firebaseUser)
    } catch {
      warning = 'Account created, but the verification email could not be sent. Use Send verification email below.'
    }
    const nextUser = baseUser(firebaseUser)
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
      if (registrationWarning.current.includes('verification email')) {
        registrationWarning.current = ''
        setAccountError('')
      }
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
