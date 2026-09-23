import { qualifyingBundle, transportation, warrantyFor } from './fulfillment'
import { useSyncExternalStore } from 'react'
import { useAuth } from './auth-context'
import type { Expense, InventoryItem, Job, Sale, ProductBundle } from '../types/business'
import type { InvoiceCharges, InvoiceLine, Tier } from '../types/business'
import { invoiceTotals, money } from './commerce'
import { readShopSettings } from './preferences'

export type WorkspaceData = { jobs: Job[]; sales: Sale[]; inventory: InventoryItem[]; expenses: Expense[]; bundles: ProductBundle[] }
const empty: WorkspaceData = { jobs: [], sales: [], inventory: [], expenses: [], bundles: [] }
const storageIssues = new Map<string, string>()
function validRows(name: string, rows: unknown): boolean {
  if (!Array.isArray(rows)) return false
  const strings: Record<string, string[]> = { jobs: ['id', 'customer', 'device', 'service', 'due', 'status'], sales: ['id', 'customer', 'detail', 'date', 'status'], inventory: ['id', 'name', 'sku', 'category'], expenses: ['id', 'description', 'category', 'date', 'method'], bundles: ['id', 'name'] }
  const numbers: Record<string, string[]> = { jobs: ['quote'], sales: ['total', 'paid', 'cost'], inventory: ['stock', 'minimum', 'price', 'cost'], expenses: ['amount'], bundles: [] }
  return rows.every(row => row && typeof row === 'object' && strings[name].every(field => typeof row[field] === 'string') && numbers[name].every(field => Number.isFinite(row[field]) && row[field] >= 0) && (name !== 'bundles' || (Array.isArray(row.items) && row.items.every((item: { inventoryId: string; quantity: number }) => item && typeof item.inventoryId === 'string' && Number.isSafeInteger(item.quantity) && item.quantity > 0))))
}
const cache = new Map<string, { raw: string | null; data: WorkspaceData }>()
const eventName = 'jbc-workspace-change'
const ownerKey = 'jbc-rigworks:shop-owner:v1'
export type CheckoutDraft = { cashTendered?: number; fulfillment?: { mode: 'Pickup' | 'Delivery'; address: string; distanceKm: number }; bundleId?: string; pcSet?: boolean; customer: string; contact: string; channel: 'Walk-in' | 'Online'; paymentMethod: string; paid: number; lines: { id: string; quantity: number }[]; charges: Omit<InvoiceCharges, 'tax' | 'subtotal'>; notes: string }
function read(key: string): WorkspaceData {
  try {
    const raw = localStorage.getItem(key)
    const cached = cache.get(key)
    if (cached?.raw === raw) { storageIssues.delete(key); return cached.data }
    const parsed = raw ? JSON.parse(raw) : empty
    if (!parsed || typeof parsed !== 'object' || Object.keys(empty).some(name => parsed[name] !== undefined && !validRows(name, parsed[name]))) throw new Error('Invalid saved records')
    storageIssues.delete(key)
    const data = Object.fromEntries(Object.keys(empty).map(name => [name, Array.isArray(parsed?.[name]) ? parsed[name] : []])) as WorkspaceData
    cache.set(key, { raw, data })
    return data
  } catch { storageIssues.set(key, 'Saved workspace records could not be read. Saving is paused to protect the existing data. Reload after restoring valid browser data.'); return empty }
}
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback)
  window.addEventListener('storage', callback)
  return () => { window.removeEventListener(eventName, callback); window.removeEventListener('storage', callback) }
}
export function useWorkspace() {
  const { user } = useAuth()
  const owner = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(ownerKey) ?? '' } catch { return '' } })
  const key = `jbc-rigworks:workspace:v1:${user?.role === 'customer' ? owner || 'unconfigured-shop' : user?.id ?? 'guest'}`
  const data = useSyncExternalStore(subscribe, () => read(key))
  const write = (next: WorkspaceData) => {
    if (storageIssues.has(key)) throw new Error(storageIssues.get(key))
    try { localStorage.setItem(key, JSON.stringify(next)) }
    catch { throw new Error('Could not save. Browser storage may be full or unavailable. Your form is still here; try again.') }
    window.dispatchEvent(new Event(eventName))
  }
  function save<K extends keyof WorkspaceData>(collection: K, record: WorkspaceData[K][number]) {
    if (user?.role !== 'admin') throw new Error('Only the workshop can update these records.')
    const current = read(key)
    const rows = current[collection] as { id: string }[]
    const next = { ...current, [collection]: rows.some(row => row.id === record.id) ? rows.map(row => row.id === record.id ? record : row) : [record, ...rows] }
    if (collection === 'inventory') localStorage.setItem(ownerKey, user.id)
    write(next)
  }
  function remove(collection: keyof WorkspaceData, id: string) {
    if (user?.role !== 'admin') throw new Error('Only the workshop can delete records.')
    const current = read(key)
    if (collection === 'inventory' && current.bundles.some(bundle => bundle.items.some(item => item.inventoryId === id))) throw new Error('Remove this item from its bundles before deleting it.')
    if (collection === 'sales' && current.sales.find(sale => sale.id === id)?.lines) throw new Error('Issued invoices must be retained. Update the payment or order status instead.')
    write({ ...current, [collection]: current[collection].filter(row => row.id !== id) })
  }
  async function checkout(draft: CheckoutDraft) {
    const commit = () => {
      const current = read(key)
      const settings = readShopSettings()
      if (!user || !draft.lines.length || !draft.customer.trim()) throw new Error('Add a customer and at least one item.')
      const ids = new Set<string>()
      const lines: InvoiceLine[] = draft.lines.map(line => {
        if (ids.has(line.id) || !Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error('Check the item quantities.')
        ids.add(line.id)
        if (line.id.startsWith('clean:')) {
          const [, device, tier] = line.id.split(':')
          if (!['Desktop', 'Laptop'].includes(device) || !['Low', 'Mid', 'High'].includes(tier)) throw new Error('Unknown service.')
          const price = settings.cleaning[device as 'Desktop' | 'Laptop'][tier as Tier]
          if (price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) throw new Error('Set this service price before checkout.')
          return { id: line.id, description: `${device} deep clean - ${tier} specs`, quantity: line.quantity, unitPrice: Number(price), unitCost: 0 }
        }
        const item = current.inventory.find(item => item.id === line.id)
        if (!item || item.stock < line.quantity) throw new Error(`${item?.name ?? 'An item'} no longer has enough stock. Update the cart.`)
        return { id: line.id, inventoryId: item.id, description: item.name, quantity: line.quantity, unitPrice: item.price, unitCost: item.cost, warranty: warrantyFor(item, settings, today()) }
      })
      const fulfillment = draft.fulfillment ?? { mode: 'Pickup' as const, address: '', distanceKm: 0 }
      const bundleName = qualifyingBundle(draft.lines, current.inventory, current.bundles, draft.bundleId, draft.pcSet)
      if ((draft.bundleId || draft.pcSet) && !bundleName) throw new Error('This bundle has changed. Select the full bundle again before checkout.')
      if (fulfillment.mode === 'Delivery' && (!fulfillment.address.trim() || !draft.contact.trim() || !Number.isFinite(fulfillment.distanceKm) || fulfillment.distanceKm <= 0)) throw new Error('Enter a delivery address, contact, and a distance greater than zero.')
      if (fulfillment.mode === 'Delivery' && !lines.some(line => line.inventoryId)) throw new Error('Delivery is available for products. Book home service for cleaning visits.')
      const deliveryFee = fulfillment.mode === 'Pickup' ? 0 : bundleName ? 0 : transportation(settings, fulfillment.distanceKm)
      if (deliveryFee === null) throw new Error('Delivery rates are not configured. Choose pickup or ask the workshop to set transportation rates.')
      const baseCharges = user.role === 'customer' ? { labor: settings.labor, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: settings.taxRate } : draft.charges
      const charges = { ...baseCharges, delivery: deliveryFee }
      if ([charges.labor, charges.delivery, charges.other, charges.discount, charges.taxRate, draft.paid].some(value => !Number.isFinite(value) || value < 0) || charges.taxRate > 100) throw new Error('Enter valid charges and payment amounts.')
      const totals = invoiceTotals(lines, charges)
      if (totals.total < 0 || charges.discount > totals.subtotal + charges.labor + charges.delivery + charges.other) throw new Error('Discount exceeds the charges.')
      const paid = user.role === 'customer' ? 0 : money(draft.paid)
      if (paid > totals.total) throw new Error('Payment exceeds the invoice total.')
      if (draft.cashTendered !== undefined && (!Number.isFinite(draft.cashTendered) || draft.cashTendered < paid || draft.cashTendered > 1e12)) throw new Error('Recalculate the cash payment.')
      const sale: Sale = { cashTendered: user.role === 'admin' ? draft.cashTendered : undefined, change: user.role === 'admin' && draft.cashTendered !== undefined ? money(draft.cashTendered - paid) : undefined, orderStatus: 'Requested', fulfillment: { ...fulfillment, freeDelivery: !!bundleName, bundleName: bundleName ?? undefined, baseFee: fulfillment.mode === 'Delivery' && !bundleName ? Number(settings.transportBase) : 0, perKm: fulfillment.mode === 'Delivery' && !bundleName ? Number(settings.transportPerKm) : 0 }, id: `${settings.prefix || 'INV'}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, customer: draft.customer.trim(), contact: draft.contact.trim(), customerId: user.role === 'customer' ? user.id : undefined, channel: user.role === 'customer' ? 'Online' : draft.channel, date: today(), detail: lines.map(line => line.description).join(', '), lines, charges: { ...charges, subtotal: totals.subtotal, tax: totals.tax }, seller: { name: settings.name, address: settings.address, phone: settings.phone, email: settings.email, footer: settings.footer }, total: totals.total, paid, cost: money(lines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0)), status: paid === totals.total ? 'Paid' : paid ? 'Partial' : 'Unpaid', paymentMethod: user.role === 'customer' ? 'Pay at workshop' : draft.paymentMethod, notes: draft.notes }
      const inventory = current.inventory.map(item => { const quantity = lines.find(line => line.inventoryId === item.id)?.quantity ?? 0; return quantity ? { ...item, stock: item.stock - quantity, stockHistory: [...(item.stockHistory || []), { date: new Date().toISOString(), before: item.stock, after: item.stock - quantity, reason: 'Sale ' + sale.id }] } : item })
      write({ ...current, inventory, sales: [sale, ...current.sales] })
      return sale
    }
    return navigator.locks ? navigator.locks.request(`jbc-checkout:${key}`, commit) : commit()
  }
  return { ...data, storageError: storageIssues.get(key), sales: user?.role === 'customer' ? data.sales.filter(sale => sale.customerId === user.id) : data.sales, save, remove, checkout }
}

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const currentPeriod = () => today().slice(0, 7)
