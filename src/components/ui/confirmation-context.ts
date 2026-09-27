import { createContext, useContext } from 'react'

export type ConfirmationOptions = {
  title: string
  message: string
  confirmLabel?: string
  tone?: 'primary' | 'danger'
}

export type ConfirmationContextValue = {
  confirm: (options: ConfirmationOptions) => Promise<boolean>
}

export const ConfirmationContext = createContext<ConfirmationContextValue | null>(null)

export function useConfirmation() {
  const context = useContext(ConfirmationContext)
  if (!context) throw new Error('useConfirmation must be used inside ConfirmationProvider.')
  return context
}
