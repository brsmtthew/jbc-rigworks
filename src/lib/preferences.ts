import { useMemo, useSyncExternalStore } from 'react'
import type { Seller, Tier } from '../types/business'

const event = 'jbc-settings-change'
export function useStoredValue<T extends object>(key: string, fallback: T) {
  const raw = useSyncExternalStore(callback => {
    window.addEventListener(event, callback); window.addEventListener('storage', callback)
    return () => { window.removeEventListener(event, callback); window.removeEventListener('storage', callback) }
  }, () => { try { return localStorage.getItem(key) } catch { return null } })
  const value = useMemo(() => {
    try {
      const parsed = raw ? JSON.parse(raw) : {}
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback
      return Object.fromEntries(Object.entries(fallback).map(([key, initial]) => [key, typeof parsed[key] === typeof initial && parsed[key] !== null ? parsed[key] : initial])) as T
    } catch { return fallback }
  }, [raw, fallback])
  const save = (next: T) => { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(event)) }
  return [value, save] as const
}
export type ShopSettings = Seller & { prefix: string; taxRate: number; labor: number; delivery: number; homeSurcharge: string; transportBase: string; transportPerKm: string; warrantyMonths: string; warrantyTerms: string; cleaning: Record<'Desktop' | 'Laptop', Record<Tier, string>> }
export const shopKey = 'jbc-rigworks:shop-settings:v1'
export const defaultShop: ShopSettings = { name: 'JBC RigWorks', address: '', phone: '', email: '', footer: 'Thank you for choosing JBC RigWorks.', prefix: 'INV', taxRate: 0, labor: 0, delivery: 0, homeSurcharge: '', transportBase: '', transportPerKm: '', warrantyMonths: '', warrantyTerms: '', cleaning: { Desktop: { Low: '', Mid: '', High: '' }, Laptop: { Low: '', Mid: '', High: '' } } }
function normalizeShop(raw: Partial<ShopSettings>): ShopSettings {
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
  const [value, save] = useStoredValue(shopKey, defaultShop)
  return [useMemo(() => normalizeShop(value), [value]), save] as const
}
export function readShopSettings(): ShopSettings {
  try { return normalizeShop(JSON.parse(localStorage.getItem(shopKey) ?? '{}')) } catch { return defaultShop }
}
export type AccountSettings = { name: string; contactEmail: string; phone: string; address: string; compact: boolean; reduceMotion: boolean; photo: string }
export const defaultAccount: AccountSettings = { name: '', contactEmail: '', phone: '', address: '', compact: false, reduceMotion: false, photo: '' }
export const accountKey = (id: string) => `jbc-rigworks:account:v1:${id}`
