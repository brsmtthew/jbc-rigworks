import { qualifyingBundle, transportation, warrantyFor } from './fulfillment'
import { deleteDoc, runTransaction, setDoc, where, writeBatch } from 'firebase/firestore'
import { useAuth } from './auth-context'
import type { Expense, InventoryItem, Job, Sale, SalePayment, ProductBundle } from '../types/business'
import type { InvoiceCharges, InvoiceLine, Tier } from '../types/business'
import { invoiceTotals, money } from './commerce'
import { defaultShop, normalizeShop } from './preferences'
import { isPcPart, isSellable } from './pc'
import { firestoreData, recordRef, shopRef, useLiveCollection } from './database'
import { firebaseFirestore } from './firebase'
import { recordReceipt, validEmail } from './payments'
import type { PaymentProof } from '../types/business'

export type WorkspaceData = { jobs: Job[]; sales: Sale[]; inventory: InventoryItem[]; expenses: Expense[]; bundles: ProductBundle[] }
const empty: WorkspaceData = { jobs: [], sales: [], inventory: [], expenses: [], bundles: [] }
function publicItem(item: InventoryItem): InventoryItem {
  return {
    id: item.id, name: item.name, sku: item.sku, category: item.category,
    stock: item.stock, price: item.price, cost: 0, minimum: 0,
    image: item.image, specs: item.specs, component: item.component, tier: item.tier,
    socket: item.socket, warrantyMonths: item.warrantyMonths, warrantyTerms: item.warrantyTerms,
    memoryType: item.memoryType, cores: item.cores, memoryGb: item.memoryGb, vramGb: item.vramGb,
    kind: item.kind, brand: item.brand, model: item.model,
  }
}
export type CheckoutDraft = { receiptEmail?: string; cashTendered?: number; fulfillment?: { mode: 'Pickup' | 'Delivery'; address: string; distanceKm: number }; bundleId?: string; pcSet?: boolean; jobId?: string; customServices?: { id: string; description: string; unitPrice: number }[]; customer: string; contact: string; channel: 'Walk-in' | 'Online'; paymentMethod: string; paid: number; lines: { id: string; quantity: number }[]; charges: Omit<InvoiceCharges, 'tax' | 'subtotal'>; notes: string }
export function useWorkspace() {
  const { user } = useAuth()
  const admin = user?.role === 'admin'
  const jobs = useLiveCollection<Job>('jobs', admin)
  const sales = useLiveCollection<Sale>('sales', admin)
  const orders = useLiveCollection<Sale>('orders', !!user, user && !admin ? [where('customerId', '==', user.id)] : [], admin ? 'admin' : user?.id)
  const inventory = useLiveCollection<InventoryItem>(admin ? 'inventory' : 'catalog', !!user)
  const expenses = useLiveCollection<Expense>('expenses', admin)
  const bundles = useLiveCollection<ProductBundle>('bundles', !!user)
  const data: WorkspaceData = {
    jobs: jobs.rows, sales: admin ? sales.rows : orders.rows, inventory: inventory.rows,
    expenses: expenses.rows, bundles: bundles.rows,
  }
  const storageError = [jobs, sales, orders, inventory, expenses, bundles].map(item => item.error).find(Boolean) || undefined
  const loading = [jobs, sales, orders, inventory, expenses, bundles].some(item => item.loading)
  async function save<K extends keyof WorkspaceData>(collection: K, record: WorkspaceData[K][number], expectedStock?: number) {
    if (user?.role !== 'admin') throw new Error('Only the workshop can update these records.')
    if (collection === 'inventory') {
      const item = record as InventoryItem
      await runTransaction(firebaseFirestore, async transaction => {
        const ref = recordRef('inventory', item.id)
        const current = await transaction.get(ref)
        if (expectedStock !== undefined && (!current.exists() || current.data().stock !== expectedStock)) throw new Error('Stock changed while you were editing. Reopen the item before saving.')
        transaction.set(ref, firestoreData(item))
        if (isSellable(item)) transaction.set(recordRef('catalog', item.id), firestoreData(publicItem(item)))
        else transaction.delete(recordRef('catalog', item.id))
      })
      return
    }
    if (collection === 'sales' && (record as Sale).customerId) {
      const batch = writeBatch(firebaseFirestore)
      const sale = record as Sale
      batch.set(recordRef('sales', sale.id), firestoreData(sale))
      batch.set(recordRef('orders', sale.id), firestoreData({ ...sale, cost: 0, lines: sale.lines?.map(line => ({ ...line, unitCost: 0 })) }))
      await batch.commit()
      return
    }
    await setDoc(recordRef(collection, record.id), firestoreData(record))
  }
  async function remove(collection: keyof WorkspaceData, id: string) {
    if (user?.role !== 'admin') throw new Error('Only the workshop can delete records.')
    if (collection === 'inventory' && data.bundles.some(bundle => bundle.items.some(item => item.inventoryId === id))) throw new Error('Remove this item from its bundles before deleting it.')
    if (collection === 'sales' && data.sales.find(sale => sale.id === id)?.lines) throw new Error('Issued invoices must be retained. Update the payment or order status instead.')
    if (collection === 'inventory') {
      const batch = writeBatch(firebaseFirestore)
      batch.delete(recordRef('inventory', id))
      batch.delete(recordRef('catalog', id))
      await batch.commit()
    } else await deleteDoc(recordRef(collection, id))
  }
  async function checkout(draft: CheckoutDraft) {
    return runTransaction(firebaseFirestore, async transaction => {
      if (!user || !draft.lines.length || !draft.customer.trim()) throw new Error('Add a customer and at least one item.')
      if (draft.lines.length > 50) throw new Error('A checkout can contain up to 50 item lines.')
      const receiptEmail = (draft.receiptEmail || (user.role === 'user' ? user.email : '')).trim()
      if (receiptEmail && !validEmail(receiptEmail)) throw new Error('Enter a valid receipt email address.')
      if (user.role === 'admin' && draft.paymentMethod !== 'Cash') throw new Error('Record cash here. Bank or e-wallet transfers must be verified from their payment proof.')
      const itemIds = [...new Set(draft.lines.filter(line => !line.id.startsWith('clean:') && !draft.customServices?.some(service => service.id === line.id)).map(line => line.id))]
      const [shopSnapshot, bundleSnapshot, jobSnapshot, ...itemSnapshots] = await Promise.all([
        transaction.get(shopRef),
        draft.bundleId ? transaction.get(recordRef('bundles', draft.bundleId)) : Promise.resolve(null),
        draft.jobId ? transaction.get(recordRef('jobs', draft.jobId)) : Promise.resolve(null),
        ...itemIds.map(id => transaction.get(recordRef(user.role === 'admin' ? 'inventory' : 'catalog', id))),
      ])
      const settings = normalizeShop(shopSnapshot.exists() ? shopSnapshot.data() : defaultShop)
      const current: WorkspaceData = {
        ...empty,
        inventory: itemSnapshots.filter(snapshot => snapshot.exists()).map(snapshot => snapshot.data() as InventoryItem),
        bundles: bundleSnapshot?.exists() ? [bundleSnapshot.data() as ProductBundle] : [],
        jobs: jobSnapshot?.exists() ? [jobSnapshot.data() as Job] : [],
      }
      if (draft.jobId) {
        const job = current.jobs.find(value => value.id === draft.jobId)
        if (user.role !== 'admin' || !job || job.status !== 'Ready') throw new Error('Only a ready service job can be sent to checkout.')
      }
      const ids = new Set<string>()
      const lines: InvoiceLine[] = draft.lines.map(line => {
        if (ids.has(line.id) || !Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error('Check the item quantities.')
        ids.add(line.id)
        const customService = draft.customServices?.find(service => service.id === line.id)
        if (customService) {
          if (user.role === 'user') throw new Error('Services must be booked through the service and booking page.')
          if (!customService.description.trim() || !Number.isFinite(customService.unitPrice) || customService.unitPrice < 0) throw new Error('This service line has invalid details.')
          return { id: line.id, description: customService.description.trim(), quantity: line.quantity, unitPrice: money(customService.unitPrice), unitCost: 0 }
        }
        if (line.id.startsWith('clean:')) {
          if (user.role === 'user') throw new Error('Services must be booked through the service and booking page.')
          const [, device, tier] = line.id.split(':')
          if (!['Desktop', 'Laptop'].includes(device) || !['Low', 'Mid', 'High'].includes(tier)) throw new Error('Unknown service.')
          const price = settings.cleaning[device as 'Desktop' | 'Laptop'][tier as Tier]
          if (price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) throw new Error('Set this service price before checkout.')
          return { id: line.id, description: `${device} deep clean - ${tier} specs`, quantity: line.quantity, unitPrice: Number(price), unitCost: 0 }
        }
        const item = current.inventory.find(item => item.id === line.id)
        if (item && (!isSellable(item) || (user.role === 'user' && !isPcPart(item)))) throw new Error('Only sellable PC parts can be ordered from the customer shop.')
        if (!item || item.stock < line.quantity) throw new Error(`${item?.name ?? 'An item'} no longer has enough stock. Update the cart.`)
        return { id: line.id, inventoryId: item.id, description: item.name, quantity: line.quantity, unitPrice: item.price, unitCost: item.cost, warranty: warrantyFor(item, settings, today()) }
      })
      const fulfillment = user.role === 'user' ? { mode: 'Pickup' as const, address: '', distanceKm: 0 } : draft.fulfillment ?? { mode: 'Pickup' as const, address: '', distanceKm: 0 }
      const bundleName = qualifyingBundle(draft.lines, current.inventory, current.bundles, draft.bundleId, draft.pcSet)
      if ((draft.bundleId || draft.pcSet) && !bundleName) throw new Error('This bundle has changed. Select the full bundle again before checkout.')
      if (fulfillment.mode === 'Delivery' && (!fulfillment.address.trim() || !draft.contact.trim() || !Number.isFinite(fulfillment.distanceKm) || fulfillment.distanceKm <= 0)) throw new Error('Enter a delivery address, contact, and a distance greater than zero.')
      if (fulfillment.mode === 'Delivery' && !lines.some(line => line.inventoryId)) throw new Error('Delivery is available for products. Book home service for cleaning visits.')
      const deliveryFee = fulfillment.mode === 'Pickup' ? 0 : bundleName ? 0 : transportation(settings, fulfillment.distanceKm)
      if (deliveryFee === null) throw new Error('Delivery rates are not configured. Choose pickup or ask the workshop to set transportation rates.')
      const baseCharges = user.role === 'user' ? { labor: settings.labor, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: settings.taxRate } : draft.charges
      const charges = { ...baseCharges, delivery: deliveryFee }
      if ([charges.labor, charges.delivery, charges.other, charges.discount, charges.taxRate, draft.paid].some(value => !Number.isFinite(value) || value < 0) || charges.taxRate > 100) throw new Error('Enter valid charges and payment amounts.')
      const totals = invoiceTotals(lines, charges)
      if (totals.total < 0 || charges.discount > totals.subtotal + charges.labor + charges.delivery + charges.other) throw new Error('Discount exceeds the charges.')
      const paid = user.role === 'user' ? 0 : money(draft.paid)
      if (paid > totals.total) throw new Error('Payment exceeds the invoice total.')
      if (draft.cashTendered !== undefined && (!Number.isFinite(draft.cashTendered) || draft.cashTendered < paid || draft.cashTendered > 1e12)) throw new Error('Recalculate the cash payment.')
      const initialPayment: SalePayment[] = paid > 0 ? [{ id: crypto.randomUUID(), date: new Date().toISOString(), amount: paid, method: 'Cash', ...(user.role === 'admin' && draft.cashTendered !== undefined ? { cashTendered: draft.cashTendered, change: money(draft.cashTendered - paid) } : {}) }] : []
      const sale: Sale = { cashTendered: user.role === 'admin' ? draft.cashTendered : undefined, change: user.role === 'admin' && draft.cashTendered !== undefined ? money(draft.cashTendered - paid) : undefined, orderStatus: 'Requested', fulfillment: { ...fulfillment, freeDelivery: !!bundleName, bundleName: bundleName ?? undefined, bundleId: draft.bundleId, pcSet: draft.pcSet, baseFee: fulfillment.mode === 'Delivery' && !bundleName ? Number(settings.transportBase) : 0, perKm: fulfillment.mode === 'Delivery' && !bundleName ? Number(settings.transportPerKm) : 0 }, id: `${settings.prefix || 'INV'}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, customer: draft.customer.trim(), contact: draft.contact.trim(), customerId: user.role === 'user' ? user.id : undefined, channel: user.role === 'user' ? 'Online' : draft.channel, date: today(), detail: lines.map(line => line.description).join(', '), lines, charges: { ...charges, subtotal: totals.subtotal, tax: totals.tax }, seller: { name: settings.name, address: settings.address, phone: settings.phone, email: settings.email, footer: settings.footer }, total: totals.total, paid, cost: money(lines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0)), status: user.role === 'user' ? 'Unpaid' : paid === totals.total ? 'Paid' : paid ? 'Partial' : 'Unpaid', paymentMethod: 'Cash', notes: draft.notes, serviceJobId: draft.jobId, paymentHistory: initialPayment }
      const inventory = current.inventory.map(item => { const quantity = lines.find(line => line.inventoryId === item.id)?.quantity ?? 0; return quantity ? { ...item, stock: item.stock - quantity, stockHistory: [...(item.stockHistory || []), { date: new Date().toISOString(), before: item.stock, after: item.stock - quantity, reason: 'Sale ' + sale.id }] } : item })
      const jobs = draft.jobId ? current.jobs.map(job => job.id === draft.jobId ? { ...job, status: 'Completed' as const } : job) : current.jobs
      sale.receiptEmail = receiptEmail
      sale.paymentMethod = 'Cash'
      if (user.role === 'admin' && initialPayment.length) sale.lastReceiptId = recordReceipt(transaction, sale, initialPayment[0], user.id)
      transaction.set(recordRef(user.role === 'admin' ? 'sales' : 'orders', sale.id), firestoreData(sale))
      if (user.role === 'admin') {
        for (const item of inventory) {
          if (item.stock !== current.inventory.find(original => original.id === item.id)?.stock) {
            transaction.set(recordRef('inventory', item.id), firestoreData(item))
            transaction.set(recordRef('catalog', item.id), firestoreData(publicItem(item)))
          }
        }
        if (draft.jobId) transaction.set(recordRef('jobs', draft.jobId), firestoreData(jobs[0]))
      }
      return sale
    })
  }
  async function collectPayment(saleId: string, amount: number, options: { cashTendered?: number; verifyProof?: boolean; receiptEmail?: string } = {}) {
    return runTransaction(firebaseFirestore, async transaction => {
      if (user?.role !== 'admin') throw new Error('Only the workshop can collect payments.')
      const ref = recordRef('sales', saleId)
      const proofRef = recordRef('paymentProofs', saleId)
      const [snapshot, proofSnapshot] = await Promise.all([transaction.get(ref), transaction.get(proofRef)])
      const sale = snapshot.exists() ? snapshot.data() as Sale : null
      const proof = proofSnapshot.exists() ? proofSnapshot.data() as PaymentProof : null
      const orderRef = recordRef('orders', saleId)
      if (sale?.customerId) await transaction.get(orderRef)
      if (!sale) throw new Error('Invoice unavailable. Refresh the Sales page and try again.')
      const balance = money(sale.total - sale.paid)
      if (!Number.isFinite(amount) || amount <= 0 || amount !== money(amount) || amount > balance) throw new Error('Enter a payment greater than zero and no more than the invoice balance, using up to two decimal places.')
      if (options.verifyProof && (!proof || proof.status !== 'Pending' || proof.amount !== amount || proof.orderId !== saleId || proof.customerId !== sale.customerId)) throw new Error('This proof is no longer pending or its amount does not match. Refresh the order before verifying.')
      if (!options.verifyProof && proof?.status === 'Pending') throw new Error('Review the pending transfer proof first. Reject it before collecting cash to avoid recording the payment twice.')
      const paymentMethod = options.verifyProof ? proof!.method : 'Cash'
      const cashTendered = options.verifyProof ? undefined : options.cashTendered
      const receiptEmail = (options.receiptEmail ?? sale.receiptEmail ?? '').trim()
      if (receiptEmail && !validEmail(receiptEmail)) throw new Error('Enter a valid receipt email address.')
      if (cashTendered !== undefined && (!Number.isFinite(cashTendered) || cashTendered < amount || cashTendered > 1e12)) throw new Error('Cash received must cover the payment amount.')
      const paid = money(sale.paid + amount)
      const payment: SalePayment = { id: crypto.randomUUID(), date: new Date().toISOString(), amount: money(amount), method: paymentMethod, ...(options.verifyProof ? { reference: proof!.reference, proofId: saleId } : {}), ...(cashTendered !== undefined ? { cashTendered: money(cashTendered), change: money(cashTendered - amount) } : {}) }
      const updated: Sale = { ...sale, receiptEmail, paid, status: paid >= sale.total ? 'Paid' : 'Partial', paymentMethod, cashTendered: payment.cashTendered, change: payment.change, paymentHistory: [...(sale.paymentHistory ?? []), payment] }
      updated.lastReceiptId = recordReceipt(transaction, updated, payment, user.id)
      if (options.verifyProof) transaction.update(proofRef, { status: 'Verified', reviewedAt: payment.date, reviewedBy: user.id })
      transaction.set(ref, firestoreData(updated))
      if (updated.customerId) transaction.set(orderRef, firestoreData({ ...updated, cost: 0, lines: updated.lines?.map(line => ({ ...line, unitCost: 0 })) }))
      return updated
    })
  }
  async function updateOrderStatus(saleId: string, nextStatus: NonNullable<Sale['orderStatus']>) {
    if (user?.role !== 'admin') throw new Error('Only the workshop can process orders.')
    return runTransaction(firebaseFirestore, async transaction => {
      const saleRef = recordRef('sales', saleId)
      const orderRef = recordRef('orders', saleId)
      const [orderSnapshot, saleSnapshot, shopSnapshot, proofSnapshot] = await Promise.all([transaction.get(orderRef), transaction.get(saleRef), transaction.get(shopRef), transaction.get(recordRef('paymentProofs', saleId))])
      if (!orderSnapshot.exists()) throw new Error('Order unavailable.')
      const order = orderSnapshot.data() as Sale
      if (order.orderStatus === 'Declined') throw new Error('A declined order cannot be processed.')
      if (order.orderStatus === 'Completed' && nextStatus !== 'Completed') throw new Error('Pickup has already been completed.')
      if (nextStatus === 'Completed' && (!saleSnapshot.exists() || saleSnapshot.data().paid < saleSnapshot.data().total)) throw new Error('Record or verify the full payment in POS before completing pickup.')
      if (nextStatus === 'Declined' && proofSnapshot.data()?.status === 'Pending') throw new Error('Review the pending payment proof in POS before declining this order.')
      if (saleSnapshot.exists() && nextStatus === 'Requested') throw new Error('A processed order cannot return to Requested.')
      if (saleSnapshot.exists() && nextStatus === 'Declined') throw new Error('A processed order cannot be declined after stock was reserved.')
      const reserveStock = !saleSnapshot.exists() && nextStatus !== 'Requested' && nextStatus !== 'Declined'
      if (reserveStock && (!Array.isArray(order.lines) || !order.lines.length || order.lines.length > 50 || order.lines.some(line => !line.inventoryId || !Number.isSafeInteger(line.quantity) || line.quantity < 1))) throw new Error('This order has invalid item lines.')
      const itemIds = reserveStock ? [...new Set((order.lines ?? []).map(line => line.inventoryId).filter((id): id is string => !!id))] : []
      const itemSnapshots = await Promise.all(itemIds.map(id => transaction.get(recordRef('inventory', id))))
      const bundleSnapshot = reserveStock && order.fulfillment?.bundleId ? await transaction.get(recordRef('bundles', order.fulfillment.bundleId)) : null
      if (reserveStock) {
        if (typeof order.customer !== 'string' || !order.customer.trim() || (order.contact !== undefined && typeof order.contact !== 'string') || itemIds.length !== order.lines!.length) throw new Error('This order has invalid customer or item details.')
        const settings = normalizeShop(shopSnapshot.exists() ? shopSnapshot.data() : defaultShop)
        const items = itemSnapshots.map(snapshot => {
          if (!snapshot.exists()) throw new Error('An ordered item is no longer in inventory.')
          return snapshot.data() as InventoryItem
        })
        const selected = order.lines!.map(line => {
          const item = items.find(value => value.id === line.inventoryId)
          if (!item || !isSellable(item) || !isPcPart(item) || line.unitPrice !== item.price) throw new Error('An item or price changed. Ask the customer to place the order again.')
          return { id: item.id, inventoryId: item.id, description: item.name, quantity: line.quantity, unitPrice: item.price, unitCost: item.cost, warranty: warrantyFor(item, settings, today()) }
        })
        const bundleName = qualifyingBundle(selected.map(line => ({ id: line.inventoryId!, quantity: line.quantity })), items, bundleSnapshot?.exists() ? [bundleSnapshot.data() as ProductBundle] : [], order.fulfillment?.bundleId, order.fulfillment?.pcSet)
        const fulfillment = order.fulfillment
        if (!fulfillment || !['Pickup', 'Delivery'].includes(fulfillment.mode) || (fulfillment.mode === 'Delivery' && (!fulfillment.address?.trim() || !order.contact?.trim() || !Number.isFinite(fulfillment.distanceKm) || fulfillment.distanceKm <= 0))) throw new Error('Order fulfillment details are incomplete.')
        const deliveryFee = fulfillment.mode === 'Pickup' ? 0 : bundleName ? 0 : transportation(settings, fulfillment.distanceKm)
        if (deliveryFee === null) throw new Error('Delivery rates are not configured.')
        const charges = { labor: settings.labor, delivery: deliveryFee, other: 0, otherLabel: '', discount: 0, taxRate: settings.taxRate }
        const totals = invoiceTotals(selected, charges)
        if (order.total !== totals.total || order.charges?.labor !== charges.labor || order.charges?.delivery !== charges.delivery || order.charges?.taxRate !== charges.taxRate || order.charges?.other !== 0 || order.charges?.discount !== 0 || order.paid !== 0) throw new Error('Order pricing changed. Ask the customer to place the order again.')
        for (const snapshot of itemSnapshots) {
          const item = snapshot.data() as InventoryItem
          const quantity = selected.filter(line => line.inventoryId === item.id).reduce((sum, line) => sum + line.quantity, 0)
          if (item.stock < quantity) throw new Error(`${item.name} does not have enough stock to process this order.`)
          const updatedItem = { ...item, stock: item.stock - quantity, stockHistory: [...(item.stockHistory ?? []), { date: new Date().toISOString(), before: item.stock, after: item.stock - quantity, reason: 'Online order ' + order.id }] }
          transaction.set(snapshot.ref, firestoreData(updatedItem))
          transaction.set(recordRef('catalog', item.id), firestoreData(publicItem(updatedItem)))
        }
        const trustedSale: Sale = {
          id: saleId, customerId: order.customerId, customer: order.customer.trim(), contact: order.contact,
          receiptEmail: typeof order.receiptEmail === 'string' && validEmail(order.receiptEmail) ? order.receiptEmail : '',
          channel: 'Online', date: today(), detail: selected.map(line => line.description).join(', '),
          lines: selected, total: totals.total, paid: 0, status: 'Unpaid',
          paymentMethod: 'Cash', paymentHistory: [],
          notes: typeof order.notes === 'string' ? order.notes : '',
          cost: money(selected.reduce((sum, line) => sum + line.unitCost * line.quantity, 0)),
          charges: { ...charges, subtotal: totals.subtotal, tax: totals.tax },
          fulfillment: {
            mode: fulfillment.mode, address: fulfillment.mode === 'Delivery' ? fulfillment.address : '',
            distanceKm: fulfillment.mode === 'Delivery' ? fulfillment.distanceKm : 0,
            freeDelivery: !!bundleName, bundleName: bundleName ?? undefined,
            bundleId: fulfillment.bundleId, pcSet: fulfillment.pcSet,
            baseFee: fulfillment.mode === 'Delivery' && !bundleName ? Number(settings.transportBase) : 0,
            perKm: fulfillment.mode === 'Delivery' && !bundleName ? Number(settings.transportPerKm) : 0,
          },
          seller: { name: settings.name, address: settings.address, phone: settings.phone, email: settings.email, footer: settings.footer },
          orderStatus: nextStatus,
        }
        transaction.set(saleRef, firestoreData(trustedSale))
        transaction.set(orderRef, firestoreData({ ...trustedSale, cost: 0, lines: selected.map(line => ({ ...line, unitCost: 0 })) }))
        return trustedSale
      }
      const updatedOrder = { ...order, orderStatus: nextStatus }
      transaction.set(orderRef, firestoreData(updatedOrder))
      if (saleSnapshot.exists()) transaction.set(saleRef, firestoreData({ ...saleSnapshot.data(), orderStatus: nextStatus }))
      return updatedOrder
    })
  }
  return { ...data, orders: orders.rows, storageError, loading, save, remove, checkout, collectPayment, updateOrderStatus }
}

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const currentPeriod = () => today().slice(0, 7)
