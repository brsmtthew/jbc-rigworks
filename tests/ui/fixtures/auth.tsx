import { AuthContext } from '../../../src/lib/auth-context'
import type { ReactNode } from 'react'
export function AuthProvider({ children }: { children: ReactNode }) {
  const user = {
    id: 'fixture-user',
    name: 'Jamie Santos',
    email: 'jamie@example.test',
    role: location.pathname.startsWith('/customer') ? ('user' as const) : ('admin' as const),
    emailVerified: true,
    adminVerificationRequired: false,
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading: false,
        accountError: '',
        signIn: async () => user,
        register: async () => user,
        refreshAccount: async () => user,
        resendVerificationEmail: async () => {},
        updateProfile: async () => {},
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
