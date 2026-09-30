import { useCallback, useSyncExternalStore } from 'react'
import { shop } from './data'
export {
  defaultShop,
  normalizeShop,
  shopKey,
  type ShopSettings,
} from '../../../src/lib/shopSettings'
export const defaultAccount = {
  name: 'Jamie Santos',
  contactEmail: 'jamie@example.test',
  phone: '09171234567',
  address: 'Manila',
  compact: false,
  reduceMotion: false,
  photo: '',
}
export const accountKey = (id: string) => `jbc-rigworks:account:v1:${id}`
const values = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()
export function useStoredValue<T>(key: string, fallback: T) {
  const subscribe = useCallback((listener: () => void) => {
    const group = listeners.get(key) ?? new Set<() => void>()
    group.add(listener)
    listeners.set(key, group)
    return () => {
      group.delete(listener)
      if (!group.size) listeners.delete(key)
    }
  }, [key])
  const getSnapshot = useCallback(
    () => (values.has(key) ? values.get(key) as T : fallback),
    [key, fallback],
  )
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const save = async (next: T) => {
    values.set(key, next)
    listeners.get(key)?.forEach((listener) => listener())
  }
  return [value, save, { loading: false, error: '' }] as const
}
export function useShopSettings() {
  return useStoredValue('shop', shop)
}
