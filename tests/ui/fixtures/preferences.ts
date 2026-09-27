import { useState } from 'react'
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
export function useStoredValue<T>(key: string, fallback: T) {
  const [value, setValue] = useState(fallback)
  return [value, async (next: T) => setValue(next), { loading: false, error: '' }] as const
}
export function useShopSettings() {
  return useStoredValue('shop', shop)
}
