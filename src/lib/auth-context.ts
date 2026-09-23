import { createContext, useContext } from 'react'
import type { AppUser, UserRole } from '../types/business'

export type AuthContextValue = {
  user: AppUser | null
  signIn: (email: string, password: string, role: UserRole) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  updateProfile: (name: string) => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
