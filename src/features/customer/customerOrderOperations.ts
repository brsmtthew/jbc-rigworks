import { runTransaction } from 'firebase/firestore'
import { firestoreData, recordRef } from '../../lib/database'
import { firebaseFirestore } from '../../lib/firebase'
import type { AppUser, Sale } from '../../types'

export type PendingOrderEdits = {
  customer: string
  contact: string
  receiptEmail: string
  notes: string
  address: string
}

export async function changePendingOrder(
  user: AppUser,
  id: string,
  updates: PendingOrderEdits | null,
) {
  const ref = recordRef('orders', id)
  return runTransaction(firebaseFirestore, async (tx) => {
    const snapshot = await tx.get(ref)
    const order = snapshot.data() as Sale | undefined
    if (
      !order ||
      order.customerId !== user.id ||
      order.channel !== 'Online' ||
      (order.orderStatus ?? 'Requested') !== 'Requested' ||
      order.paid !== 0 ||
      (order.reservationState ?? 'None') !== 'None'
    )
      throw new Error('This order has already entered workshop processing. Refresh your orders.')
    if (!updates) {
      const cancelled: Sale = {
        ...order,
        orderStatus: 'Cancelled',
        cancelledBy: user.id,
        cancelledAt: new Date().toISOString(),
      }
      tx.set(ref, firestoreData(cancelled))
      return cancelled
    }
    const customer = updates.customer.trim()
    const contact = updates.contact.trim()
    const receiptEmail = updates.receiptEmail.trim()
    const address = updates.address.trim()
    if (
      !customer ||
      customer.length > 120 ||
      contact.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail) ||
      receiptEmail.length > 254 ||
      updates.notes.length > 1000 ||
      address.length > 400 ||
      (order.fulfillment?.mode === 'Delivery' && (!address || !contact))
    )
      throw new Error('Check the name, contact, receipt email, and delivery address.')
    const changed: Sale = {
      ...order,
      customer,
      contact,
      receiptEmail,
      notes: updates.notes.trim(),
      fulfillment: order.fulfillment ? { ...order.fulfillment, address } : undefined,
    }
    tx.set(ref, firestoreData(changed))
    return changed
  })
}
