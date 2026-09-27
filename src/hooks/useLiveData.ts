import {
  onSnapshot,
  query,
  type DocumentData,
  type Query,
  type QueryConstraint,
} from 'firebase/firestore'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { collectionRef, recordRef } from '../lib/database'
import { firebaseAuth } from '../lib/firebase'
import { humanError } from '../lib/workflow'

type CollectionState = { rows: (DocumentData & { id: string })[]; error: string; loading: boolean }
const subscriptions = new Map<
  string,
  { state: CollectionState; listeners: Set<() => void>; stop: () => void }
>()
const idle: CollectionState = { rows: [], error: '', loading: false }
const pending: CollectionState = { rows: [], error: '', loading: true }
export function useLiveCollection<T extends { id: string }>(
  name: string,
  enabled = true,
  constraints: QueryConstraint[] = [],
  queryKey = '',
) {
  const signature = `${firebaseAuth.currentUser?.uid ?? ''}:${name}:${enabled}:${queryKey}`
  const source = useMemo<Query<DocumentData, DocumentData>>(
    () => query(collectionRef(name), ...constraints),
    // The caller supplies a key for every constraint value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, queryKey],
  )
  const subscribe = useMemo(
    () => (listener: () => void) => {
      if (!enabled) return () => {}
      let entry = subscriptions.get(signature)
      if (!entry) {
        entry = { state: pending, listeners: new Set(), stop: () => {} }
        subscriptions.set(signature, entry)
        const shared = entry
        shared.stop = onSnapshot(
          source,
          (snapshot) => {
            shared.state = {
              rows: snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
              error: '',
              loading: false,
            }
            shared.listeners.forEach((notify) => notify())
          },
          (error) => {
            shared.state = { rows: [], error: humanError(error), loading: false }
            shared.listeners.forEach((notify) => notify())
          },
        )
      }
      entry.listeners.add(listener)
      return () => {
        entry.listeners.delete(listener)
        if (!entry.listeners.size) {
          entry.stop()
          subscriptions.delete(signature)
        }
      }
    },
    [enabled, signature, source],
  )
  const state = useSyncExternalStore(subscribe, () =>
    enabled ? (subscriptions.get(signature)?.state ?? pending) : idle,
  )
  return state as { rows: T[]; error: string; loading: boolean }
}

export function useLiveDocument<T>(name: string, id?: string) {
  const key = `${firebaseAuth.currentUser?.uid ?? ''}:${name}/${id || ''}`
  const [state, setState] = useState<{ key: string; value?: T; error: string; loading: boolean }>({
    key,
    error: '',
    loading: !!id,
  })
  useEffect(() => {
    if (!id) return
    return onSnapshot(
      recordRef(name, id),
      (snapshot) =>
        setState({
          key,
          value: snapshot.exists() ? (snapshot.data() as T) : undefined,
          error: '',
          loading: false,
        }),
      (error) => setState({ key, error: humanError(error), loading: false }),
    )
  }, [name, id, key])
  return id && state.key === key ? state : { value: undefined, error: '', loading: !!id }
}
