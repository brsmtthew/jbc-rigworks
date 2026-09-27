import { runTransaction } from 'firebase/firestore'
import { money } from '../../lib/commerce'
import { firestoreData, recordRef, shopRef } from '../../lib/database'
import { firebaseFirestore } from '../../lib/firebase'
import { customerSale } from '../../lib/saleSnapshots'
import { normalizeShop } from '../../lib/shopSettings'
import { writeStock } from '../../lib/stock'
import { assertTransition, availableStock, buildTransitions } from '../../lib/workflow'
import type { AppUser, CustomPcRequest, InventoryItem, Sale } from '../../types'
import { reviewBuild } from './buildReview'
import { isSellable } from './pc'

export async function recordBuildApproval(
  user: AppUser,
  id: string,
  note: string,
  expectedQuoteAt: string,
) {
  if (user.role !== 'admin' || !note.trim() || note.length > 1000)
    throw new Error('Enter how and when the customer approved this quote.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const ref = recordRef('pcRequests', id),
      snapshot = await tx.get(ref)
    const build = snapshot.data() as CustomPcRequest | undefined
    if (
      !build ||
      build.status !== 'Quoted' ||
      !build.quote ||
      build.quote.createdAt !== expectedQuoteAt
    )
      throw new Error(
        'This quote has changed. Reopen it and confirm the customer approved the current version.',
      )
    tx.update(ref, {
      status: 'Approved',
      approvedAt: new Date().toISOString(),
      approvedBy: user.id,
      approvalNote: note.trim(),
    })
  })
}

export async function advanceBuild(user: AppUser, id: string, next: CustomPcRequest['status']) {
  if (user.role !== 'admin') throw new Error('Only the workshop can manage builds.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const ref = recordRef('pcRequests', id),
      snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('Build unavailable.')
    const build = snapshot.data() as CustomPcRequest
    assertTransition(buildTransitions, build.status, next)
    const orderId = build.transactionId || `BUILD-${id}`
    const [saleDoc, settingsDoc, orderDoc, proofDoc] = await Promise.all([
      tx.get(recordRef('sales', orderId)),
      tx.get(shopRef),
      tx.get(recordRef('orders', orderId)),
      tx.get(recordRef('paymentProofs', orderId)),
    ])
    if (next === 'Completed' && saleDoc.data()?.status !== 'Paid')
      throw new Error('Collect the build payment in POS before completion.')
    if (next === 'Cancelled' && (saleDoc.data()?.paid ?? 0) > 0)
      throw new Error('Paid builds need a refund process before cancellation.')
    if (next === 'Cancelled' && proofDoc.data()?.status === 'Pending')
      throw new Error('Review the pending transfer proof in POS before cancelling this build.')
    const reserve = next === 'Parts reserved',
      release = next === 'Cancelled' && build.reservationState === 'Reserved'
    const parts = (build.parts ?? []).filter(
      (part) => part.inventoryId && ['Stock', 'inventory'].includes(part.source),
    )
    if (new Set(parts.map((part) => part.inventoryId)).size !== parts.length)
      throw new Error('A build cannot reserve the same inventory item twice.')
    const itemDocs =
      reserve || release
        ? await Promise.all(parts.map((part) => tx.get(recordRef('inventory', part.inventoryId!))))
        : []
    const items = itemDocs.map((doc) => doc.data() as InventoryItem)
    if (reserve) {
      if (
        !build.parts?.length ||
        new Set(build.parts.map((part) => part.component)).size !== build.parts.length
      )
        throw new Error('Review the component selections before reserving this build.')
      if (!build.quote || build.quote.amount <= 0 || !build.customerId)
        throw new Error('Prepare an approved quote for this customer before reserving.')
      if (
        items.some(
          (item) => !item || !isSellable(item) || item.active === false || availableStock(item) < 1,
        )
      )
        throw new Error('A selected part is no longer available.')
      const review = reviewBuild(build, items)
      if (review.unavailable.length)
        throw new Error(
          'Review unavailable or incorrectly categorized components before reservation.',
        )
      if (review.errors.length)
        throw new Error('Resolve incompatible components before reservation.')
      const shop = normalizeShop(settingsDoc.data() ?? {})
      const lines = items.map((item) => ({
        id: item.id,
        inventoryId: item.id,
        description: item.name,
        category: item.category,
        quantity: 1,
        unitPrice: item.price,
        unitCost: item.cost,
      }))
      const subtotal = money(lines.reduce((sum, line) => sum + line.unitPrice, 0)),
        total = build.quote.amount
      const beforeTax = money(total / (1 + shop.taxRate / 100)),
        tax = money(total - beforeTax)
      const order: Sale = {
        schemaVersion: 2,
        id: orderId,
        buildId: id,
        customerId: build.customerId,
        customer: build.customerName ?? 'Customer',
        contact: build.customerEmail,
        receiptEmail: build.customerEmail,
        channel: 'Online',
        date: new Date().toISOString().slice(0, 10),
        detail: `PC build / ${build.useCase}`,
        total,
        cost: money(items.reduce((sum, item) => sum + item.cost, 0)),
        paid: 0,
        status: 'Unpaid',
        paymentStatus: 'Unpaid',
        orderStatus: 'Confirmed',
        reservationState: 'Reserved',
        lines,
        charges: {
          subtotal,
          taxRate: shop.taxRate,
          tax,
          labor: Math.max(0, money(beforeTax - subtotal)),
          discount: Math.max(0, money(subtotal - beforeTax)),
          delivery: 0,
          other: 0,
          otherLabel: '',
        },
        paymentHistory: [],
        seller: {
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          email: shop.email,
          footer: shop.footer,
        },
      }
      tx.set(recordRef('orderSnapshots', orderId), firestoreData(order))
      tx.set(recordRef('orders', orderId), firestoreData(customerSale(order)))
    }
    for (const item of items) {
      if (!item) throw new Error('Reserved inventory is missing.')
      writeStock(
        tx,
        item,
        { ...item, reserved: (item.reserved ?? 0) + (reserve ? 1 : -1) },
        {
          type: reserve ? 'PC_BUILD_RESERVATION' : 'RESERVATION_RELEASED',
          referenceType: 'pcRequest',
          referenceId: id,
          performedBy: user.id,
        },
      )
    }
    if (orderDoc.exists() && ['Assembly', 'Ready', 'Completed', 'Cancelled'].includes(next))
      tx.update(recordRef('orders', orderId), {
        orderStatus: {
          Assembly: 'Processing',
          Ready: 'Ready',
          Completed: 'Completed',
          Cancelled: 'Cancelled',
        }[next as 'Assembly' | 'Ready' | 'Completed' | 'Cancelled'],
        ...(release ? { reservationState: 'Released' } : {}),
      })
    if (saleDoc.exists() && next === 'Completed')
      tx.update(recordRef('sales', orderId), { orderStatus: 'Completed' })
    const updated = {
      ...build,
      status: next,
      ...(next === 'Cancelled'
        ? { cancelledAt: new Date().toISOString(), cancelledBy: user.id }
        : {}),
      ...(reserve
        ? { reservationState: 'Reserved' as const, transactionId: orderId }
        : release
          ? { reservationState: 'Released' as const }
          : {}),
    }
    tx.set(ref, firestoreData(updated))
    return updated
  })
}
