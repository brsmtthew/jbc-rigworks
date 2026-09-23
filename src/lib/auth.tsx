import { useState, type ReactNode } from 'react'
import { accountKey } from './preferences'
import type { AppUser, UserRole } from '../types/business'
import { AuthContext } from './auth-context'

const storageKey = 'jbc-rigworks:session'

function readSession(): AppUser | null {
  try {
    const value = sessionStorage.getItem(storageKey)
    const parsed = value ? JSON.parse(value) : null
    return parsed && ['id', 'name', 'email'].every(field => typeof parsed[field] === 'string') && ['admin', 'customer'].includes(parsed.role) ? parsed as AppUser : null
  } catch {
    return null
  }
}

function makeUser(name: string, email: string, role: UserRole): AppUser {
  let savedName = ''
  try { savedName = JSON.parse(localStorage.getItem(accountKey(email.trim().toLowerCase())) ?? '{}').name || '' } catch { /* Use the entered name. */ }
  return { id: email.trim().toLowerCase(), name: savedName || name.trim() || email.split('@')[0], email: email.trim().toLowerCase(), role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(readSession)
  const beginSession = (nextUser: AppUser) => {
    sessionStorage.setItem(storageKey, JSON.stringify(nextUser))
    setUser(nextUser)
  }
  const signIn = async (email: string, password: string, role: UserRole) => {
    if (!email.trim() || password.length < 6) throw new Error('Enter an email and a password with at least 6 characters.')
    beginSession(makeUser('', email, role))
  }
  const register = async (name: string, email: string, password: string) => {
    if (!name.trim() || !email.trim() || password.length < 6) throw new Error('Enter your name, email, and a password with at least 6 characters.')
    beginSession(makeUser(name, email, 'customer'))
  }
  const updateProfile = (name: string) => { if (user) beginSession({ ...user, name }) }
  const signOut = () => {
    sessionStorage.removeItem(storageKey)
    setUser(null)
  }
  return <AuthContext.Provider value={{ user, signIn, register, updateProfile, signOut }}>{children}</AuthContext.Provider>
}
