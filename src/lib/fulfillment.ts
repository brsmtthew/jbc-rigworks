import { componentOf, components } from '../features/builder/pc'
import type { InventoryItem, ProductBundle } from '../types'
import { money } from './commerce'
import type { ShopSettings } from './shopSettings'

export function optionalPrice(value: string): number | null {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}
export function transportation(settings: ShopSettings, distance: number): number | null {
  const base = optionalPrice(settings.transportBase),
    rate = optionalPrice(settings.transportPerKm)
  if (base === null || rate === null || !Number.isFinite(distance) || distance < 0) return null
  return money(base + rate * distance)
}
export function qualifyingBundle(
  lines: { id: string; quantity: number }[],
  inventory: InventoryItem[],
  bundles: ProductBundle[],
  bundleId?: string,
  pcSet?: boolean,
): string | null {
  if (bundleId) {
    const bundle = bundles.find((item) => item.id === bundleId)
    if (
      bundle &&
      bundle.active !== false &&
      bundle.published !== false &&
      bundle.items.length >= 2 &&
      bundle.items.every((item) =>
        lines.some((line) => line.id === item.inventoryId && line.quantity >= item.quantity),
      )
    )
      return bundle.name
  }
  if (
    pcSet &&
    components.every((component) =>
      lines.some(
        (line) =>
          line.quantity >= 1 &&
          inventory.some((item) => item.id === line.id && componentOf(item) === component.name),
      ),
    )
  )
    return 'Complete PC set'
  return null
}
export function bundlePriceAdjustment(
  bundle: ProductBundle | undefined,
  inventory: InventoryItem[],
) {
  if (!bundle || bundle.price === undefined) return { discount: 0, other: 0, otherLabel: '' }
  if (!Number.isFinite(bundle.price) || bundle.price < 0)
    throw new Error('This bundle price is invalid.')
  const subtotal = bundle.items.reduce(
    (sum, line) =>
      sum + (inventory.find((item) => item.id === line.inventoryId)?.price ?? 0) * line.quantity,
    0,
  )
  const difference = money(bundle.price - subtotal)
  return {
    discount: Math.max(0, -difference),
    other: Math.max(0, difference),
    otherLabel: difference > 0 ? 'Bundle price adjustment' : '',
  }
}
export function warrantyFor(item: InventoryItem, settings: ShopSettings, date: string) {
  const months = optionalPrice(item.warrantyMonths ?? settings.warrantyMonths)
  const starts = date
  let expires: string | null = null
  if (months !== null && Number.isSafeInteger(months)) {
    const start = new Date(date + 'T00:00:00Z')
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months + 1, 0))
    end.setUTCDate(Math.min(start.getUTCDate(), end.getUTCDate()))
    expires = end.toISOString().slice(0, 10)
  }
  return {
    months,
    terms:
      item.warrantyTerms ||
      settings.warrantyTerms ||
      'Warranty terms pending workshop confirmation.',
    starts,
    expires,
  }
}
