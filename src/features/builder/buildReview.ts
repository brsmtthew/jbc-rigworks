import { availableStock } from '../../lib/workflow'
import type { CustomPcRequest, InventoryItem } from '../../types'
import { compatibilitySummary, componentOf, components, isSellable } from './pc'

export function reviewBuild(request: CustomPcRequest, inventory: InventoryItem[]) {
  const rows = (request.parts ?? []).map((part) => {
    const owned = part.source === 'Custom' || part.source === 'customer_owned'
    const item: InventoryItem | undefined = owned
      ? {
          ...part.compatibility,
          id: `owned:${part.component}`,
          name: part.model,
          brand: part.brand,
          category: part.component,
          component: part.component,
          specs: part.specs,
          sku: '',
          stock: 0,
          reserved: 0,
          minimum: 0,
          price: 0,
          cost: 0,
        }
      : inventory.find((item) => item.id === part.inventoryId)
    const reservedForBuild = request.reservationState === 'Reserved' ? 1 : 0
    const available =
      !!item &&
      (owned ||
        (isSellable(item) &&
          componentOf(item) === part.component &&
          availableStock(item) + reservedForBuild > 0))
    return { part, owned, item, available }
  })
  return {
    rows,
    ...compatibilitySummary(rows.flatMap((row) => (row.item ? [row.item] : []))),
    missing: components.filter(
      (component) => !rows.some((row) => row.part.component === component.name),
    ),
    unavailable: rows.filter((row) => !row.available),
    subtotal: rows.reduce((sum, row) => sum + (!row.owned && row.item ? row.item.price : 0), 0),
  }
}
