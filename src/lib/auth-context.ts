import { createContext, useContext } from 'react'
import type { AppUser } from '../types'

export type AuthContextValue = {
  user: AppUser | null
  loading: boolean
  accountError: string
  signIn: (email: string, password: string) => Promise<AppUser>
  register: (name: string, email: string, password: string) => Promise<AppUser>
  refreshAccount: () => Promise<AppUser>
  resendVerificationEmail: () => Promise<void>
  updateProfile: (name: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
