import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Dialog } from './Dialog'
import { ConfirmationContext, type ConfirmationOptions } from './confirmation-context'

type PendingConfirmation = ConfirmationOptions & { resolve: (confirmed: boolean) => void }

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const pendingRef = useRef<PendingConfirmation | null>(null)

  const finish = useCallback((confirmed: boolean) => {
    const current = pendingRef.current
    if (!current) return
    pendingRef.current = null
    setPending(null)
    current.resolve(confirmed)
  }, [])

  const confirm = useCallback((options: ConfirmationOptions) => new Promise<boolean>(resolve => {
    if (pendingRef.current) {
      pendingRef.current.resolve(false)
    }
    const next = { ...options, resolve }
    pendingRef.current = next
    setPending(next)
  }), [])

  return <ConfirmationContext.Provider value={{ confirm }}>
    {children}
    {pending && <Dialog title={pending.title} onClose={() => finish(false)}>
      <div className="confirmation-content"><p>{pending.message}</p><div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={() => finish(false)}>Cancel</button>
        <button type="button" className={pending.tone === 'danger' ? 'primary-button danger-confirm-button' : 'primary-button'} onClick={() => finish(true)}>{pending.confirmLabel ?? 'Confirm'}</button>
      </div></div>
    </Dialog>}
  </ConfirmationContext.Provider>
}
