import { getDocFromServer } from 'firebase/firestore'
import { runTransaction } from 'firebase/firestore'
import { invoiceTotals, money } from '../../lib/commerce'
import { firestoreData, recordRef, shopRef } from '../../lib/database'
import { today } from '../../lib/dates'
import { firebaseFirestore } from '../../lib/firebase'
import { bundlePriceAdjustment, qualifyingBundle, warrantyFor } from '../../lib/fulfillment'
import { customerSale } from '../../lib/saleSnapshots'
import { normalizeShop } from '../../lib/shopSettings'
import { writeStock } from '../../lib/stock'
import { assertTransition, availableStock, orderTransitions } from '../../lib/workflow'
import type {
  AppUser,
  InventoryItem,
  PaymentProof,
  ProductBundle,
  Sale,
  SalePayment,
} from '../../types'
import { isSellable } from '../builder/pc'
import { recordReceipt, validEmail } from '../finance/payments'

export async function transitionOrder(
  user: AppUser,
  id: string,
  next: NonNullable<Sale['orderStatus']>,
) {
  if (user.role !== 'admin') throw new Error('Only the workshop can process orders.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const orderRef = recordRef('orders', id),
      saleRef = recordRef('sales', id)
    const [orderDoc, saleDoc, settingsDoc, proofDoc] = await Promise.all([
      tx.get(orderRef),
      tx.get(saleRef),
      tx.get(shopRef),
      tx.get(recordRef('paymentProofs', id)),
    ])
    if (!orderDoc.exists()) throw new Error('Order unavailable.')
    const order = orderDoc.data() as Sale
    if (order.buildId || order.serviceJobId)
      throw new Error('Use the linked build or service workflow to change its status.')
    const current = order.orderStatus ?? 'Requested'
    assertTransition(orderTransitions, current, next)
    if (next === 'Completed' && order.paid < order.total)
      throw new Error('Collect full payment in POS before releasing the order.')
    if (next === 'Out for delivery' && order.fulfillment?.mode !== 'Delivery')
      throw new Error('This is a pickup order.')
    if (next === 'Ready' && order.fulfillment?.mode === 'Delivery')
      throw new Error('Use Out for delivery for this order.')
    if (next === 'Cancelled' && (order.paid > 0 || proofDoc.data()?.status === 'Pending'))
      throw new Error(
        'Review the payment in POS before cancellation. Paid transactions require a refund process.',
      )
    const reserve = next === 'Confirmed'
    const release = next === 'Cancelled' && order.reservationState === 'Reserved'
    const lines = order.lines ?? []
    if (
      reserve &&
      (!lines.length ||
        lines.length > 50 ||
        new Set(lines.map((line) => line.inventoryId)).size !== lines.length ||
        lines.some(
          (line) => !line.inventoryId || !Number.isSafeInteger(line.quantity) || line.quantity < 1,
        ))
    )
      throw new Error('Order item quantities are invalid.')
    const itemDocs =
      reserve || release
        ? await Promise.all(lines.map((line) => tx.get(recordRef('inventory', line.inventoryId!))))
        : []
    const bundleDoc =
      reserve && order.fulfillment?.bundleId
        ? await tx.get(recordRef('bundles', order.fulfillment.bundleId))
        : null
    const settings = normalizeShop(settingsDoc.data() ?? {})
    let updated: Sale = { ...order, orderStatus: next }
    if (reserve) {
      const trustedLines = lines.map((line, index) => {
        const item = itemDocs[index].data() as InventoryItem | undefined
        if (
          !item ||
          !isSellable(item) ||
          item.active === false ||
          availableStock(item) < line.quantity
        )
          throw new Error(`${item?.name ?? 'An item'} is unavailable. Refresh the order.`)
        if (item.price !== line.unitPrice)
          throw new Error(
            'A product price changed. Review pricing with the customer before placing a replacement order.',
          )
        return {
          ...line,
          id: item.id,
          description: item.name,
          category: item.category,
          unitPrice: item.price,
          unitCost: item.cost,
          warranty: warrantyFor(item, settings, today()),
        }
      })
      const bundle = bundleDoc?.data() as ProductBundle | undefined
      const items = itemDocs.map((doc) => doc.data() as InventoryItem)
      if (
        order.fulfillment?.bundleId &&
        (!bundle ||
          !qualifyingBundle(
            lines.map((line) => ({ id: line.inventoryId!, quantity: line.quantity })),
            items,
            [bundle],
            bundle.id,
          ))
      )
        throw new Error('The bundle has changed or is no longer published.')
      const delivery =
        order.fulfillment?.mode === 'Delivery' && !bundle?.freeDelivery ? settings.delivery : 0
      if (
        order.fulfillment?.mode === 'Delivery' &&
        (!order.fulfillment.address.trim() || !order.contact?.trim())
      )
        throw new Error('Enter a delivery address and contact.')
      const charges = {
        labor: 0,
        delivery,
        ...bundlePriceAdjustment(bundle, items),
        taxRate: settings.taxRate,
      }
      const totals = invoiceTotals(trustedLines, charges)
      if (
        order.total !== totals.total ||
        order.paid !== 0 ||
        order.charges?.labor !== 0 ||
        order.charges?.other !== charges.other ||
        order.charges?.discount !== charges.discount
      )
        throw new Error(
          'Order prices or charges changed. Ask the customer to review and submit a new order.',
        )
      updated = {
        ...updated,
        schemaVersion: 2,
        lines: trustedLines,
        reservationState: 'Reserved',
        paymentStatus:
          proofDoc.data()?.status === 'Pending'
            ? 'Pending verification'
            : proofDoc.data()?.status === 'Rejected'
              ? 'Rejected'
              : 'Unpaid',
        cost: money(trustedLines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0)),
        charges: { ...charges, ...totals },
        seller: {
          name: settings.name,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          footer: settings.footer,
        },
      }
    }
    for (let i = 0; i < itemDocs.length; i++) {
      const item = itemDocs[i].data() as InventoryItem
      if (!item)
        throw new Error('Reserved inventory is missing. Contact the workshop administrator.')
      writeStock(
        tx,
        item,
        {
          ...item,
          reserved: (item.reserved ?? 0) + (reserve ? lines[i].quantity : -lines[i].quantity),
        },
        {
          type: reserve ? 'ORDER_RESERVATION' : 'RESERVATION_RELEASED',
          referenceType: 'order',
          referenceId: id,
          performedBy: user.id,
        },
      )
    }
    if (release) updated.reservationState = 'Released'
    if (next === 'Cancelled') {
      updated.cancelledAt = new Date().toISOString()
      updated.cancelledBy = user.id
    }
    // Private pending-order snapshot retains COGS without creating a recognized sale.
    if (reserve) tx.set(recordRef('orderSnapshots', id), firestoreData(updated))
    tx.set(orderRef, firestoreData(customerSale(updated)))
    if (saleDoc.exists()) tx.update(saleRef, { orderStatus: next })
    return updated
  })
}

export async function collectOrderPayment(
  user: AppUser,
  id: string,
  amount: number,
  options: { cashTendered?: number; verifyProof?: boolean; receiptEmail?: string } = {},
) {
  if (user.role !== 'admin') throw new Error('Only the workshop can collect payment.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const saleRef = recordRef('sales', id),
      orderRef = recordRef('orders', id),
      proofRef = recordRef('paymentProofs', id)
    const [saleDoc, orderDoc, proofDoc, privateDoc, settingsDoc] = await Promise.all([
      tx.get(saleRef),
      tx.get(orderRef),
      tx.get(proofRef),
      tx.get(recordRef('orderSnapshots', id)),
      tx.get(shopRef),
    ])
    const sale = (
      saleDoc.exists()
        ? saleDoc.data()
        : privateDoc.exists()
          ? {
              ...privateDoc.data(),
              ...orderDoc.data(),
              lines: privateDoc.data().lines,
              cost: privateDoc.data().cost,
            }
          : orderDoc.data()
    ) as Sale | undefined
    if (!sale || ['Cancelled', 'Declined'].includes(sale.orderStatus ?? ''))
      throw new Error('This order cannot be paid.')
    if (!saleDoc.exists() && (!privateDoc.exists() || sale.reservationState !== 'Reserved'))
      throw new Error('Confirm the order and reserve its stock before collecting payment.')
    const balance = money(sale.total - sale.paid)
    if (!Number.isFinite(amount) || balance <= 0 || amount !== balance)
      throw new Error('Collect the full remaining amount. This order may already be paid.')
    const proof = proofDoc.data() as PaymentProof | undefined
    if (
      options.verifyProof &&
      (!proof ||
        proof.status !== 'Pending' ||
        proof.amount !== amount ||
        proof.customerId !== sale.customerId)
    )
      throw new Error('The payment proof changed. Refresh and review it again.')
    if (!options.verifyProof && proof?.status === 'Pending')
      throw new Error('Review the pending transfer proof before collecting cash.')
    if (
      !options.verifyProof &&
      (!Number.isFinite(options.cashTendered) || options.cashTendered! < amount)
    )
      throw new Error('Cash received must cover the amount due.')
    if (options.receiptEmail && !validEmail(options.receiptEmail))
      throw new Error('Enter a valid receipt email.')
    const consume = sale.reservationState === 'Reserved'
    const inventoryLines = (sale.lines ?? []).filter((line) => line.inventoryId)
    const itemDocs = consume
      ? await Promise.all(
          inventoryLines.map((line) => tx.get(recordRef('inventory', line.inventoryId!))),
        )
      : []
    const at = new Date().toISOString()
    const payment: SalePayment = {
      id: crypto.randomUUID(),
      date: at,
      amount,
      method: options.verifyProof ? proof!.method : 'Cash',
      ...(options.verifyProof
        ? {
            reference: proof!.reference,
            proofId: id,
            accountId: proof!.accountId,
            verifiedAt: at,
            verifiedBy: user.id,
          }
        : { cashTendered: options.cashTendered, change: money(options.cashTendered! - amount) }),
    }
    const settings = normalizeShop(settingsDoc.data() ?? {})
    const updated: Sale = {
      ...sale,
      schemaVersion: 2,
      date: today(),
      paidAt: at,
      paid: sale.total,
      status: 'Paid',
      paymentStatus: 'Paid',
      reservationState: 'Consumed',
      receiptEmail: options.receiptEmail ?? sale.receiptEmail,
      paymentMethod: payment.method,
      cashTendered: payment.cashTendered,
      change: payment.change,
      paymentHistory: [...(sale.paymentHistory ?? []), payment],
      lines: sale.lines?.map((line) => {
        const item = itemDocs.find((doc) => doc.id === line.inventoryId)?.data() as
          InventoryItem | undefined
        return item ? { ...line, warranty: warrantyFor(item, settings, today()) } : line
      }),
    }
    for (let i = 0; i < itemDocs.length; i++) {
      const item = itemDocs[i].data() as InventoryItem | undefined,
        quantity = inventoryLines[i].quantity
      if (!item || (item.reserved ?? 0) < quantity || item.stock < quantity)
        throw new Error('Reserved stock changed. Refresh and reconcile the order before payment.')
      writeStock(
        tx,
        item,
        { ...item, stock: item.stock - quantity, reserved: (item.reserved ?? 0) - quantity },
        { type: 'SALE', referenceType: 'order', referenceId: id, performedBy: user.id },
      )
    }
    updated.lastReceiptId = recordReceipt(tx, updated, payment, user.id)
    if (options.verifyProof)
      tx.update(proofRef, { status: 'Verified', reviewedAt: at, reviewedBy: user.id })
    if (updated.buildId)
      tx.update(recordRef('pcRequests', updated.buildId), { reservationState: 'Consumed' })
    tx.set(saleRef, firestoreData(updated))
    if (updated.customerId) tx.set(orderRef, firestoreData(customerSale(updated)))
    return updated
  })
}

/** Fetch the authoritative invoice first, falling back to its unpaid order. */
export async function findPayableOrder(id: string): Promise<Sale> {
  const [order, invoice] = await Promise.all([
    getDocFromServer(recordRef('orders', id)),
    getDocFromServer(recordRef('sales', id)),
  ])
  const found = invoice.exists()
    ? (invoice.data() as Sale)
    : order.exists()
      ? (order.data() as Sale)
      : null
  if (!found) throw new Error('No order matches this reference.')
  if (found.orderStatus === 'Declined')
    throw new Error('This order was declined. Ask the customer to place a new order.')
  return found
}
