import { adaptServices, defaultSchedule } from '../features/services/serviceCatalog'
import type { BookingSchedule, Seller, ServiceOffering, Tier } from '../types'

export type ShopSettings = Seller & {
  services: ServiceOffering[]
  schedule: BookingSchedule
  prefix: string
  taxRate: number
  labor: number
  delivery: number
  homeSurcharge: string
  transportBase: string
  transportPerKm: string
  warrantyMonths: string
  warrantyTerms: string
  cleaning: Record<'Desktop' | 'Laptop', Record<Tier, string>>
}
export const shopKey = 'jbc-rigworks:shop-settings:v1'
export const defaultShop: ShopSettings = {
  services: [],
  schedule: defaultSchedule,
  name: 'JBC RigWorks',
  address: '',
  phone: '',
  email: '',
  footer: 'Thank you for choosing JBC RigWorks.',
  prefix: 'INV',
  taxRate: 0,
  labor: 0,
  delivery: 0,
  homeSurcharge: '',
  transportBase: '',
  transportPerKm: '',
  warrantyMonths: '',
  warrantyTerms: '',
  cleaning: { Desktop: { Low: '', Mid: '', High: '' }, Laptop: { Low: '', Mid: '', High: '' } },
}
export function normalizeShop(raw: Partial<ShopSettings>): ShopSettings {
  const cleaning = {
    Desktop: { ...defaultShop.cleaning.Desktop },
    Laptop: { ...defaultShop.cleaning.Laptop },
  }
  for (const device of ['Desktop', 'Laptop'] as const)
    for (const tier of ['Low', 'Mid', 'High'] as const) {
      const price = raw?.cleaning?.[device]?.[tier]
      cleaning[device][tier] =
        typeof price === 'string' &&
        (price === '' || (Number.isFinite(Number(price)) && Number(price) >= 0))
          ? price
          : ''
    }
  const safe = Object.fromEntries(
    Object.entries(defaultShop).map(([key, value]) => {
      const candidate = raw?.[key as keyof ShopSettings]
      return [
        key,
        typeof candidate === typeof value &&
        candidate !== null &&
        (typeof candidate !== 'number' || (Number.isFinite(candidate) && candidate >= 0))
          ? candidate
          : value,
      ]
    }),
  ) as ShopSettings
  return {
    ...safe,
    taxRate: Math.min(100, safe.taxRate),
    cleaning,
    services:
      Array.isArray(raw.services) && raw.services.length ? raw.services : adaptServices(cleaning),
    schedule: { ...defaultSchedule, ...raw.schedule },
  }
}
