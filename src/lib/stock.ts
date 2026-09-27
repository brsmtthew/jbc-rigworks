import type { Transaction } from 'firebase/firestore'
import { isSellable } from '../features/builder/pc'
import type { InventoryItem, StockMovement } from '../types'
import { firestoreData, recordRef } from './database'

/** Cost-redacted projection only. All stock mutations start at inventory. */
export function publicItem(item: InventoryItem): InventoryItem {
  const {
    cost: _cost,
    stockHistory: _history,
    assetTag: _tag,
    location: _location,
    skuKey: _skuKey,
    ...product
  } = item
  void _cost
  void _history
  void _tag
  void _location
  void _skuKey
  return { ...product, cost: 0, minimum: 0 }
}
export function writeStock(
  transaction: Transaction,
  before: InventoryItem,
  after: InventoryItem,
  context: {
    type: string
    referenceType: string
    referenceId: string
    reason?: string
    performedBy: string
  },
) {
  if (
    !Number.isSafeInteger(after.stock) ||
    !Number.isSafeInteger(after.reserved ?? 0) ||
    after.stock < 0 ||
    (after.reserved ?? 0) < 0 ||
    (after.reserved ?? 0) > after.stock
  )
    throw new Error(
      'Stock could not be updated because another transaction changed the quantity. Refresh and try again.',
    )
  const timestamp = new Date().toISOString()
  const movement: StockMovement = {
    id: crypto.randomUUID(),
    itemId: after.id,
    ...context,
    reason: context.reason || `${context.type}: ${context.referenceId}`,
    timestamp,
    quantityChange: after.stock - before.stock,
    quantityBefore: before.stock,
    quantityAfter: after.stock,
    reservedBefore: before.reserved ?? 0,
    reservedAfter: after.reserved ?? 0,
  }
  const updated = {
    ...after,
    stockHistory: [
      ...(before.stockHistory ?? []),
      { date: timestamp, before: before.stock, after: after.stock, reason: movement.reason },
    ].slice(-100),
  }
  transaction.set(recordRef('inventory', after.id), firestoreData(updated))
  if (isSellable(updated))
    transaction.set(recordRef('catalog', after.id), firestoreData(publicItem(updated)))
  else transaction.delete(recordRef('catalog', after.id))
  transaction.set(recordRef('stockMovements', movement.id), firestoreData(movement))
}
