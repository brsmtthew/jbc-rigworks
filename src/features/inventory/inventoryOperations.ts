import { runTransaction } from 'firebase/firestore'
import { firestoreData, recordRef } from '../../lib/database'
import { firebaseFirestore } from '../../lib/firebase'
import { publicItem, writeStock } from '../../lib/stock'
import type { AppUser, InventoryItem } from '../../types'
import { isSellable } from '../builder/pc'
import { checkLegacySku, claimSku, skuIdentity } from './inventoryIdentity'

export async function saveInventoryItem(
  user: AppUser,
  item: InventoryItem,
  expectedStock?: number,
  known?: InventoryItem,
) {
  if (user.role !== 'admin') throw new Error('Only the workshop can update inventory.')
  if (!known?.skuKey || known.skuKey !== skuIdentity(item.sku)) await checkLegacySku(item)
  await runTransaction(firebaseFirestore, async (transaction) => {
    const ref = recordRef('inventory', item.id)
    const current = await transaction.get(ref)
    if (
      [item.cost, item.price, item.stock, item.minimum].some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    )
      throw new Error('Enter valid stock quantities and prices.')
    if (
      expectedStock !== undefined &&
      (!current.exists() || current.data().stock !== expectedStock)
    )
      throw new Error('Stock changed while you were editing. Reopen the item before saving.')
    const writeIdentity = await claimSku(
      transaction,
      item,
      current.data() as InventoryItem | undefined,
    )
    const updated = {
      ...item,
      sku: item.sku.trim(),
      skuKey: skuIdentity(item.sku),
      reserved: current.data()?.reserved ?? 0,
    }
    if (updated.active === false && updated.reserved > 0)
      throw new Error('Release reservations before deactivating this product.')
    if (updated.stock < updated.reserved)
      throw new Error('On-hand stock cannot fall below reserved stock.')
    writeIdentity()
    if (!current.exists() || current.data().stock !== item.stock)
      writeStock(
        transaction,
        current.exists() ? (current.data() as InventoryItem) : { ...item, stock: 0, reserved: 0 },
        updated,
        {
          type: current.exists()
            ? item.stockHistory?.at(-1)?.reason.split(':')[0] || 'MANUAL_CORRECTION'
            : 'OPENING_STOCK',
          referenceType: 'inventory',
          referenceId: item.id,
          reason: item.stockHistory?.at(-1)?.reason,
          performedBy: user.id,
        },
      )
    else {
      transaction.set(ref, firestoreData(updated))
      if (isSellable(updated))
        transaction.set(recordRef('catalog', item.id), firestoreData(publicItem(updated)))
      else transaction.delete(recordRef('catalog', item.id))
    }
  })
}
