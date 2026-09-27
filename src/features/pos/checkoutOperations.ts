import { runTransaction } from 'firebase/firestore'
import { invoiceTotals, money } from '../../lib/commerce'
import { firestoreData, recordRef, shopRef } from '../../lib/database'
import { today } from '../../lib/dates'
import { firebaseFirestore } from '../../lib/firebase'
import { bundlePriceAdjustment, qualifyingBundle, warrantyFor } from '../../lib/fulfillment'
import { customerSale } from '../../lib/saleSnapshots'
import { defaultShop, normalizeShop } from '../../lib/shopSettings'
import { writeStock } from '../../lib/stock'
import { availableStock, serviceState } from '../../lib/workflow'
import type {
  AppUser,
  CheckoutDraft,
  InventoryItem,
  InvoiceLine,
  Job,
  PaymentAccount,
  ProductBundle,
  Sale,
  SalePayment,
} from '../../types'
import { isSellable } from '../builder/pc'
import { accountAvailable, recordReceipt, validEmail } from '../finance/payments'

export async function checkout(user: AppUser, draft: CheckoutDraft) {
  const checkoutId = draft.idempotencyKey || crypto.randomUUID()
  return runTransaction(firebaseFirestore, async (transaction) => {
    if (!user || !draft.lines.length) throw new Error('Add at least one item.')
    if (draft.lines.length > 50) throw new Error('A checkout can contain up to 50 item lines.')
    const receiptEmail = (draft.receiptEmail || (user.role === 'user' ? user.email : '')).trim()
    if (receiptEmail && !validEmail(receiptEmail))
      throw new Error('Enter a valid receipt email address.')
    if (user.role === 'admin' && draft.paymentMethod !== 'Cash') {
      const account = draft.paymentAccountId
        ? ((await transaction.get(recordRef('paymentAccounts', draft.paymentAccountId))).data() as
            PaymentAccount | undefined)
        : undefined
      if (
        !account ||
        !accountAvailable(account) ||
        account.kind !== draft.paymentMethod ||
        account.pos === false ||
        !draft.paymentVerified ||
        !draft.paymentReference?.trim()
      )
        throw new Error(
          'Select an enabled payment account, enter the reference, and explicitly verify receipt of the full payment.',
        )
    }
    const itemIds = [
      ...new Set(
        draft.lines
          .filter(
            (line) =>
              !line.id.startsWith('service:') &&
              !line.id.startsWith('clean:') &&
              !draft.customServices?.some((service) => service.id === line.id),
          )
          .map((line) => line.id),
      ),
    ]
    const [shopSnapshot, bundleSnapshot, jobSnapshot, ...itemSnapshots] = await Promise.all([
      transaction.get(shopRef),
      draft.bundleId
        ? transaction.get(recordRef('bundles', draft.bundleId))
        : Promise.resolve(null),
      draft.jobId ? transaction.get(recordRef('jobs', draft.jobId)) : Promise.resolve(null),
      ...itemIds.map((id) =>
        transaction.get(recordRef(user.role === 'admin' ? 'inventory' : 'catalog', id)),
      ),
    ])
    const settings = normalizeShop(shopSnapshot.exists() ? shopSnapshot.data() : defaultShop)
    const saleId = `${settings.prefix || 'INV'}-${checkoutId}`
    const existing =
      user.role === 'admin' ? await transaction.get(recordRef('sales', saleId)) : null
    if (existing?.exists()) return existing.data() as Sale
    const current = {
      inventory: itemSnapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => snapshot.data() as InventoryItem),
      bundles: bundleSnapshot?.exists() ? [bundleSnapshot.data() as ProductBundle] : [],
      jobs: jobSnapshot?.exists() ? [jobSnapshot.data() as Job] : [],
    }
    if (draft.jobId) {
      const job = current.jobs.find((value) => value.id === draft.jobId)
      if (
        user.role !== 'admin' ||
        !job ||
        serviceState(job.status) !== 'Ready for checkout' ||
        job.transactionId ||
        job.paymentStatus === 'Paid'
      )
        throw new Error('Only an unpaid, ready service can be sent to checkout.')
      if (draft.customServices?.[0]?.unitPrice !== job.quote)
        throw new Error('The approved service quote changed. Open the service in POS again.')
    }
    const ids = new Set<string>()
    const lines: InvoiceLine[] = draft.lines.map((line) => {
      if (ids.has(line.id) || !Number.isSafeInteger(line.quantity) || line.quantity < 1)
        throw new Error('Check the item quantities.')
      ids.add(line.id)
      const customService = draft.customServices?.find((service) => service.id === line.id)
      if (customService) {
        if (user.role === 'user')
          throw new Error('Services must be booked through the service and booking page.')
        if (
          !customService.description.trim() ||
          !Number.isFinite(customService.unitPrice) ||
          customService.unitPrice < 0
        )
          throw new Error('This service line has invalid details.')
        return {
          id: line.id,
          description: customService.description.trim(),
          quantity: line.quantity,
          unitPrice: money(customService.unitPrice),
          unitCost: 0,
        }
      }
      if (line.id.startsWith('service:')) {
        const service = settings.services.find(
          (service) => `service:${service.id}` === line.id && service.active,
        )
        if (user.role !== 'admin' || !service || service.price === '')
          throw new Error('This service is unavailable or needs a quote.')
        return {
          id: line.id,
          description: `${service.name} / ${service.deviceType}`,
          quantity: line.quantity,
          unitPrice: Number(service.price),
          unitCost: 0,
        }
      }
      if (line.id.startsWith('clean:'))
        throw new Error(
          'This old service shortcut has been retired. Choose a current service from the catalog.',
        )
      const item = current.inventory.find((item) => item.id === line.id)
      if (item && (!isSellable(item) || item.active === false))
        throw new Error('This product is no longer available.')
      if (!item || availableStock(item) < line.quantity)
        throw new Error(`${item?.name ?? 'An item'} no longer has enough stock. Update the cart.`)
      return {
        id: line.id,
        inventoryId: item.id,
        description: item.name,
        category: item.category,
        quantity: line.quantity,
        unitPrice: item.price,
        unitCost: item.cost,
        warranty: warrantyFor(item, settings, today()),
      }
    })
    const fulfillment = draft.fulfillment ?? { mode: 'Pickup' as const, address: '', distanceKm: 0 }
    const bundleName = qualifyingBundle(
      draft.lines,
      current.inventory,
      current.bundles,
      draft.bundleId,
      draft.pcSet,
    )
    const selectedBundle = bundleName
      ? current.bundles.find((bundle) => bundle.id === draft.bundleId)
      : undefined
    const freeDelivery = !!selectedBundle?.freeDelivery
    if ((draft.bundleId || draft.pcSet) && !bundleName)
      throw new Error('This bundle has changed. Select the full bundle again before checkout.')
    if (
      fulfillment.mode === 'Delivery' &&
      (!fulfillment.address.trim() ||
        !draft.contact.trim() ||
        !Number.isFinite(fulfillment.distanceKm) ||
        fulfillment.distanceKm < 0)
    )
      throw new Error('Enter a delivery address and contact details.')
    if (fulfillment.mode === 'Delivery' && !lines.some((line) => line.inventoryId))
      throw new Error('Delivery is available for products. Book home service for cleaning visits.')
    const deliveryFee = fulfillment.mode === 'Pickup' || freeDelivery ? 0 : settings.delivery
    if (deliveryFee === null)
      throw new Error(
        'Delivery rates are not configured. Choose pickup or ask the workshop to set transportation rates.',
      )
    const baseCharges =
      user.role === 'user'
        ? {
            labor: 0,
            delivery: 0,
            other: 0,
            otherLabel: '',
            discount: 0,
            taxRate: settings.taxRate,
          }
        : draft.charges
    const charges = {
      ...baseCharges,
      ...(selectedBundle ? bundlePriceAdjustment(selectedBundle, current.inventory) : {}),
      delivery: deliveryFee,
    }
    if (
      [
        charges.labor,
        charges.delivery,
        charges.other,
        charges.discount,
        charges.taxRate,
        draft.paid,
      ].some((value) => !Number.isFinite(value) || value < 0) ||
      charges.taxRate > 100
    )
      throw new Error('Enter valid charges and payment amounts.')
    const totals = invoiceTotals(lines, charges)
    if (
      totals.total < 0 ||
      charges.discount > totals.subtotal + charges.labor + charges.delivery + charges.other
    )
      throw new Error('Discount exceeds the charges.')
    const paid = user.role === 'user' ? 0 : money(draft.paid)
    if (paid > totals.total) throw new Error('Payment exceeds the invoice total.')
    if (user.role === 'admin' && paid !== totals.total)
      throw new Error(
        'Collect the full amount before completing this sale. Partial payments are not enabled.',
      )
    if (
      draft.cashTendered !== undefined &&
      (!Number.isFinite(draft.cashTendered) ||
        draft.cashTendered < paid ||
        draft.cashTendered > 1e12)
    )
      throw new Error('Recalculate the cash payment.')
    const adminCheckout = user.role === 'admin'
    const createdAt = new Date().toISOString()
    const initialPayment: SalePayment[] = adminCheckout
      ? [
          {
            id: crypto.randomUUID(),
            date: createdAt,
            amount: paid,
            method: draft.paymentMethod,
            ...(draft.paymentMethod === 'Cash' && draft.cashTendered !== undefined
              ? { cashTendered: draft.cashTendered, change: money(draft.cashTendered - paid) }
              : {}),
            ...(draft.paymentMethod !== 'Cash'
              ? {
                  reference: draft.paymentReference,
                  accountId: draft.paymentAccountId,
                  verifiedAt: createdAt,
                  verifiedBy: user.id,
                }
              : {}),
          },
        ]
      : []
    const sale: Sale = {
      id: saleId,
      schemaVersion: 2,
      createdAt,
      date: today(),
      customer: draft.customer.trim() || 'Walk-in Customer',
      contact: draft.contact.trim(),
      customerId: adminCheckout ? current.jobs[0]?.customerId : user.id,
      channel: adminCheckout ? 'Walk-in' : 'Online',
      detail: lines.map((line) => line.description).join(', '),
      lines,
      charges: { ...charges, subtotal: totals.subtotal, tax: totals.tax },
      seller: {
        name: settings.name,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        footer: settings.footer,
      },
      total: totals.total,
      paid,
      cost: money(lines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0)),
      status: adminCheckout ? 'Paid' : 'Unpaid',
      paymentStatus: adminCheckout ? 'Paid' : 'Unpaid',
      reservationState: adminCheckout ? 'Consumed' : 'None',
      orderStatus: adminCheckout ? (draft.jobId ? 'Ready' : 'Completed') : 'Requested',
      paidAt: adminCheckout ? createdAt : undefined,
      fulfillment: lines.some((line) => line.inventoryId)
        ? {
            ...fulfillment,
            freeDelivery,
            bundleName: bundleName ?? undefined,
            bundleId: draft.bundleId,
            pcSet: draft.pcSet,
            baseFee: deliveryFee,
            perKm: 0,
          }
        : undefined,
      receiptEmail,
      paymentMethod: draft.paymentMethod,
      paymentHistory: initialPayment,
      cashTendered: initialPayment[0]?.cashTendered,
      change: initialPayment[0]?.change,
      notes: draft.notes,
      serviceJobId: draft.jobId,
    }
    const inventory = current.inventory.map((item) => ({
      ...item,
      stock: item.stock - (lines.find((line) => line.inventoryId === item.id)?.quantity ?? 0),
    }))
    const jobs = draft.jobId
      ? current.jobs.map((job) => ({
          ...job,
          transactionId: sale.id,
          paymentStatus: 'Paid' as const,
        }))
      : current.jobs
    if (adminCheckout)
      sale.lastReceiptId = recordReceipt(transaction, sale, initialPayment[0], user.id)
    transaction.set(
      recordRef(user.role === 'admin' ? 'sales' : 'orders', sale.id),
      firestoreData(sale),
    )
    if (user.role === 'admin') {
      if (sale.customerId)
        transaction.set(recordRef('orders', sale.id), firestoreData(customerSale(sale)))
      for (const item of inventory) {
        if (item.stock !== current.inventory.find((original) => original.id === item.id)?.stock) {
          writeStock(
            transaction,
            current.inventory.find((original) => original.id === item.id)!,
            item,
            { type: 'SALE', referenceType: 'sale', referenceId: sale.id, performedBy: user.id },
          )
        }
      }
      if (draft.jobId) transaction.set(recordRef('jobs', draft.jobId), firestoreData(jobs[0]))
    }
    return sale
  })
}
