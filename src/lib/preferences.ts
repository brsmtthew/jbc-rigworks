import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, setDoc } from 'firebase/firestore'
import type { Seller, Tier } from '../types/business'
import { accountSettingsRef, directoriesRef, firestoreData, shopRef } from './database'

function settingRef(key: string) {
  if (key === shopKey) return shopRef
  if (key === 'jbc-rigworks:directories:v1') return directoriesRef
  if (key.startsWith('jbc-rigworks:account:v1:')) return accountSettingsRef(key.slice('jbc-rigworks:account:v1:'.length))
  throw new Error(`Unknown settings key: ${key}`)
}

export function useStoredValue<T extends object>(key: string, fallback: T) {
  const ref = useMemo(() => settingRef(key), [key])
  const [state, setState] = useState<{ key: string; raw: Partial<T>; ready: boolean; error: string }>({ key, raw: {}, ready: false, error: '' })
  useEffect(() => onSnapshot(ref, { includeMetadataChanges: true }, snapshot => setState({ key, raw: snapshot.exists() ? snapshot.data() as Partial<T> : {}, ready: !snapshot.metadata.fromCache, error: '' }), error => setState({ key, raw: {}, ready: false, error: error.message })), [ref, key])
  const raw = useMemo(() => state.key === key ? state.raw : {} as Partial<T>, [state, key])
  const value = useMemo(() => {
    return Object.fromEntries(Object.entries(fallback).map(([field, initial]) => [field, typeof raw[field as keyof T] === typeof initial && raw[field as keyof T] !== null ? raw[field as keyof T] : initial])) as T
  }, [raw, fallback])
  const save = (next: T) => {
    if (state.key !== key || !state.ready) throw new Error(state.error || 'Settings are still loading. Try again in a moment.')
    return setDoc(ref, firestoreData(next))
  }
  return [value, save, { loading: state.key !== key || !state.ready, error: state.key === key ? state.error : '' }] as const
}
export type ShopSettings = Seller & { prefix: string; taxRate: number; labor: number; delivery: number; homeSurcharge: string; transportBase: string; transportPerKm: string; warrantyMonths: string; warrantyTerms: string; cleaning: Record<'Desktop' | 'Laptop', Record<Tier, string>> }
export const shopKey = 'jbc-rigworks:shop-settings:v1'
export const defaultShop: ShopSettings = { name: 'JBC RigWorks', address: '', phone: '', email: '', footer: 'Thank you for choosing JBC RigWorks.', prefix: 'INV', taxRate: 0, labor: 0, delivery: 0, homeSurcharge: '', transportBase: '', transportPerKm: '', warrantyMonths: '', warrantyTerms: '', cleaning: { Desktop: { Low: '', Mid: '', High: '' }, Laptop: { Low: '', Mid: '', High: '' } } }
export function normalizeShop(raw: Partial<ShopSettings>): ShopSettings {
  const cleaning = { Desktop: { ...defaultShop.cleaning.Desktop }, Laptop: { ...defaultShop.cleaning.Laptop } }
  for (const device of ['Desktop', 'Laptop'] as const) for (const tier of ['Low', 'Mid', 'High'] as const) {
    const price = raw?.cleaning?.[device]?.[tier]
    cleaning[device][tier] = typeof price === 'string' && (price === '' || (Number.isFinite(Number(price)) && Number(price) >= 0)) ? price : ''
  }
  const safe = Object.fromEntries(Object.entries(defaultShop).map(([key, value]) => {
    const candidate = raw?.[key as keyof ShopSettings]
    return [key, typeof candidate === typeof value && candidate !== null && (typeof candidate !== 'number' || Number.isFinite(candidate) && candidate >= 0) ? candidate : value]
  })) as ShopSettings
  return { ...safe, taxRate: Math.min(100, safe.taxRate), cleaning }
}
export function useShopSettings() {
  const [value, save, status] = useStoredValue(shopKey, defaultShop)
  const normalized = useMemo(() => normalizeShop(value), [value])
  return [normalized, save, status] as const
}
export type AccountSettings = { name: string; contactEmail: string; phone: string; address: string; compact: boolean; reduceMotion: boolean; photo: string }
export const defaultAccount: AccountSettings = { name: '', contactEmail: '', phone: '', address: '', compact: false, reduceMotion: false, photo: '' }
export const accountKey = (id: string) => `jbc-rigworks:account:v1:${id}`
