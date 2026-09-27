import { collection, getDocsFromServer, type Transaction } from 'firebase/firestore'
import { recordRef } from '../../lib/database'
import { firebaseFirestore } from '../../lib/firebase'
import type { InventoryItem } from '../../types'

export function skuIdentity(sku: string) {
  const normalized = sku.trim().toUpperCase()
  if (!normalized || normalized.length > 100)
    throw new Error('Enter a SKU of up to 100 characters.')
  return encodeURIComponent(normalized).replaceAll('.', '%2E')
}

// Older inventory has no registry entry. Check its current server values before
// claiming a new SKU; concurrent V2 writers serialize through the registry.
export async function checkLegacySku(item: InventoryItem) {
  const key = skuIdentity(item.sku)
  const inventory = await getDocsFromServer(collection(firebaseFirestore, 'inventory'))
  if (
    inventory.docs.some(
      (doc) =>
        doc.id !== item.id &&
        typeof doc.data().sku === 'string' &&
        doc.data().sku.trim().toUpperCase() === item.sku.trim().toUpperCase(),
    )
  )
    throw new Error('This SKU already belongs to another inventory item.')
  return key
}

export async function claimSku(tx: Transaction, item: InventoryItem, previous?: InventoryItem) {
  const key = skuIdentity(item.sku),
    ref = recordRef('inventorySkus', key)
  const oldKey = previous?.skuKey
  const [existing, old] = await Promise.all([
    tx.get(ref),
    oldKey && oldKey !== key ? tx.get(recordRef('inventorySkus', oldKey)) : Promise.resolve(null),
  ])
  if (existing.exists() && existing.data().itemId !== item.id)
    throw new Error('This SKU already belongs to another inventory item.')
  return () => {
    if (old?.exists() && old.data().itemId === item.id) tx.delete(old.ref)
    tx.set(ref, { itemId: item.id, sku: item.sku.trim() })
  }
}
