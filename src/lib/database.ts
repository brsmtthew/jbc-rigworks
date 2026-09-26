import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, type DocumentData, type Query, type QueryConstraint, query } from 'firebase/firestore'
import { firebaseFirestore } from './firebase'

export const shopRef = doc(firebaseFirestore, 'settings', 'shop')
export const directoriesRef = doc(firebaseFirestore, 'settings', 'directories')
export const accountSettingsRef = (uid: string) => doc(firebaseFirestore, 'users', uid, 'settings', 'account')
export const collectionRef = (name: string) => collection(firebaseFirestore, name)
export const recordRef = (name: string, id: string) => doc(firebaseFirestore, name, id)

// Form records contain optional fields that Firestore cannot store as undefined.
export function firestoreData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function useLiveCollection<T extends { id: string }>(name: string, enabled = true, constraints: QueryConstraint[] = [], queryKey = '') {
  const signature = `${name}:${enabled}:${queryKey}`
  const source = useMemo<Query<DocumentData, DocumentData>>(
    () => query(collectionRef(name), ...constraints),
    // Callers provide a stable key for any role or UID dependent query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, queryKey],
  )
  const [state, setState] = useState<{ rows: T[]; error: string; loading: boolean; signature: string }>({ rows: [], error: '', loading: enabled, signature })
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(source, snapshot => {
      setState({ rows: snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as T), error: '', loading: false, signature })
    }, error => setState({ rows: [], error: error.message, loading: false, signature }))
  }, [source, enabled, signature])
  return enabled && state.signature === signature ? state : { rows: [] as T[], error: '', loading: enabled }
}

export function useLiveDocument<T>(name: string, id?: string) {
  const key = `${name}/${id || ''}`
  const [state, setState] = useState<{ key: string; value?: T; error: string; loading: boolean }>({ key, error: '', loading: !!id })
  useEffect(() => {
    if (!id) return
    return onSnapshot(recordRef(name, id), snapshot => setState({ key, value: snapshot.exists() ? snapshot.data() as T : undefined, error: '', loading: false }), error => setState({ key, error: error.message, loading: false }))
  }, [name, id, key])
  return id && state.key === key ? state : { value: undefined, error: '', loading: !!id }
}
