import { useRef, useState } from 'react'
import { humanError } from '../lib/workflow'

/** Lock before awaiting confirmation; React state alone cannot stop same-tick submissions. */
export function useAsyncAction() {
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(action: () => Promise<void>) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(humanError(cause))
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}
