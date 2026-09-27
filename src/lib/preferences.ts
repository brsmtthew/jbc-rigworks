import { onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { accountSettingsRef, directoriesRef, firestoreData, shopRef } from './database'
import { defaultShop, normalizeShop, shopKey } from './shopSettings'
import { humanError } from './workflow'

function settingRef(key: string) {
  if (key === shopKey) return shopRef
  if (key === 'jbc-rigworks:directories:v1') return directoriesRef
  if (key.startsWith('jbc-rigworks:account:v1:'))
    return accountSettingsRef(key.slice('jbc-rigworks:account:v1:'.length))
  throw new Error(`Unknown settings key: ${key}`)
}

export function useStoredValue<T extends object>(key: string, fallback: T) {
  const ref = useMemo(() => settingRef(key), [key])
  const [state, setState] = useState<{
    key: string
    raw: Partial<T>
    ready: boolean
    error: string
  }>({ key, raw: {}, ready: false, error: '' })
  useEffect(
    () =>
      onSnapshot(
        ref,
        { includeMetadataChanges: true },
        (snapshot) =>
          setState({
            key,
            raw: snapshot.exists() ? (snapshot.data() as Partial<T>) : {},
            ready: !snapshot.metadata.fromCache,
            error: '',
          }),
        (error) => setState({ key, raw: {}, ready: false, error: humanError(error) }),
      ),
    [ref, key],
  )
  const raw = useMemo(() => (state.key === key ? state.raw : ({} as Partial<T>)), [state, key])
  const value = useMemo(() => {
    return Object.fromEntries(
      Object.entries(fallback).map(([field, initial]) => [
        field,
        typeof raw[field as keyof T] === typeof initial && raw[field as keyof T] !== null
          ? raw[field as keyof T]
          : initial,
      ]),
    ) as T
  }, [raw, fallback])
  const save = (next: T) => {
    if (state.key !== key || !state.ready)
      throw new Error(state.error || 'Settings are still loading. Try again in a moment.')
    return setDoc(ref, firestoreData(next))
  }
  return [
    value,
    save,
    { loading: state.key !== key || !state.ready, error: state.key === key ? state.error : '' },
  ] as const
}
export function useShopSettings() {
  const [value, save, status] = useStoredValue(shopKey, defaultShop)
  const normalized = useMemo(() => normalizeShop(value), [value])
  return [normalized, save, status] as const
}
export type AccountSettings = {
  name: string
  contactEmail: string
  phone: string
  address: string
  compact: boolean
  reduceMotion: boolean
  photo: string
}
export const defaultAccount: AccountSettings = {
  name: '',
  contactEmail: '',
  phone: '',
  address: '',
  compact: false,
  reduceMotion: false,
  photo: '',
}
export const accountKey = (id: string) => `jbc-rigworks:account:v1:${id}`
