import { availableStock } from '../../lib/workflow'
import type { ComponentType, InventoryItem, Tier } from '../../types'
import { compatibility, componentOf, components, isPcPart } from './pc'

const level = { Low: 1, Mid: 2, High: 3 } as const

function partLevel(item: InventoryItem): number | null {
  switch (componentOf(item)) {
    case 'Processor':
      if (item.cores) return item.cores >= 12 ? 3 : item.cores >= 6 ? 2 : 1
      break
    case 'Graphics':
      if (item.vramGb) return item.vramGb >= 12 ? 3 : item.vramGb >= 6 ? 2 : 1
      break
    case 'Memory':
      if (item.memoryGb) return item.memoryGb >= 32 ? 3 : item.memoryGb >= 16 ? 2 : 1
      break
  }
  return item.tier ? level[item.tier] : null
}

export function inferBuildTier(items: InventoryItem[]): Tier | 'Unclassified' {
  const rated = items
    .filter((item) => ['Processor', 'Graphics', 'Memory'].includes(componentOf(item) ?? ''))
    .map(partLevel)
    .filter((value): value is number => value !== null)
  if (!rated.length) return 'Unclassified'
  const average = rated.reduce((sum, value) => sum + value, 0) / rated.length
  return average >= 2.5 ? 'High' : average >= 1.5 ? 'Mid' : 'Low'
}

export function recommendPreset(inventory: InventoryItem[], tier: Tier) {
  const selected: InventoryItem[] = []
  for (const component of components.map((part) => part.name)) {
    const options = inventory.filter(
      (item) =>
        isPcPart(item) &&
        componentOf(item) === component &&
        item.active !== false &&
        availableStock(item) > 0,
    )
    options.sort((a, b) => {
      const conflicts =
        compatibility([...selected, a]).length - compatibility([...selected, b]).length
      if (conflicts) return conflicts
      const tierFit =
        Math.abs((partLevel(a) ?? level[tier]) - level[tier]) -
        Math.abs((partLevel(b) ?? level[tier]) - level[tier])
      return tierFit || a.price - b.price || a.name.localeCompare(b.name)
    })
    if (options[0]) selected.push(options[0])
  }
  return Object.fromEntries(selected.map((item) => [componentOf(item), item.id])) as Partial<
    Record<ComponentType, string>
  >
}
