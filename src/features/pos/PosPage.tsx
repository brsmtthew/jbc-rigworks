import { useDirectories } from '../../lib/directories'
import { Calculator, Eye } from 'lucide-react'
import { PaymentCalculator } from './PaymentCalculator'
import { ProductDialog } from '../inventory/ProductDialog'
import { Dialog } from '../../components/ui/Dialog'
import { BundleCatalog } from './BundleCatalog'
import { qualifyingBundle, transportation } from '../../lib/fulfillment'
import { useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Boxes, ArrowRight, CreditCard, LoaderCircle, Minus, Package, Plus, ShoppingCart, BrushCleaning, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SearchField } from '../../components/ui/Filters'
import { useWorkspace } from '../../lib/workspaceStorage'
import { useAuth } from '../../lib/auth-context'
import { accountKey, defaultAccount, useShopSettings, useStoredValue } from '../../lib/preferences'
import { tiers } from '../../lib/pc'
import { invoiceTotals } from '../../lib/commerce'
import { formatPHP } from '../../data/appData'
import { InvoiceDialog } from '../sales/InvoiceDialog'
import type { Sale, InventoryItem } from '../../types/business'

export function PosPage() {
  const [directory] = useDirectories()
  const [calculatorOpen, setCalculatorOpen] = useState(false), [cashTendered, setCashTendered] = useState<number | undefined>(), [productDetail, setProductDetail] = useState<InventoryItem | null>(null)
  const { user } = useAuth()
  const customerMode = user?.role === 'customer'
  const workspace = useWorkspace()
  const [shop] = useShopSettings()
  const [profile] = useStoredValue(accountKey(user!.id), defaultAccount)
  const [params] = useSearchParams()
  const location = useLocation()
  const products = [...workspace.inventory.map(item => ({ id: item.id, name: item.name, category: item.category, price: item.price, stock: item.stock, service: false })), ...(['Desktop', 'Laptop'] as const).flatMap(device => tiers.map(tier => ({ id: `clean:${device}:${tier}`, name: `${device} deep clean - ${tier} specs`, category: 'Services', price: shop.cleaning[device][tier] === '' ? null : Number(shop.cleaning[device][tier]), stock: Infinity, service: true })))]
  const [cart, setCart] = useState<{ id: string; quantity: number }[]>(() => {
    const parts = location.state?.parts as string[] | undefined
    if (Array.isArray(parts)) return [...new Set(parts)].map(id => ({ id, quantity: 1 }))
    const service = params.get('service')
    return service ? [{ id: service, quantity: 1 }] : []
  })
  const [bundleId, setBundleId] = useState<string | undefined>()
  const [pcSet, setPcSet] = useState(Boolean(location.state?.pcSet))
  const [fulfillment, setFulfillment] = useState<'Pickup' | 'Delivery'>('Pickup')
  const [address, setAddress] = useState(profile.address), [distance, setDistance] = useState('')
  const bundleName = qualifyingBundle(cart, workspace.inventory, workspace.bundles, bundleId, pcSet)
  const deliveryFee = fulfillment === 'Pickup' || bundleName ? 0 : distance === '' ? null : transportation(shop, Number(distance))
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All')
  const [customer, setCustomer] = useState(customerMode ? profile.name || user!.name : '')
  const [contact, setContact] = useState(customerMode ? [profile.phone, profile.contactEmail || user!.email].filter(Boolean).join(' / ') : '')
  const [channel, setChannel] = useState<'Walk-in' | 'Online'>(customerMode ? 'Online' : 'Walk-in')
  const [method, setMethod] = useState('Cash'), [paid, setPaid] = useState('0'), [notes, setNotes] = useState('')
  const [charges, setCharges] = useState({ labor: shop.labor, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: shop.taxRate })
  const [sale, setSale] = useState<Sale | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false), [bundlesOpen, setBundlesOpen] = useState(false)
  const submitting = useRef(false)
  const baseCharges = customerMode ? { labor: shop.labor, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: shop.taxRate } : charges
  const effectiveCharges = { ...baseCharges, delivery: deliveryFee ?? 0 }
  const lines = cart.map(line => { const product = products.find(product => product.id === line.id); return { ...line, description: product?.name ?? 'Unavailable item', unitPrice: product?.price ?? 0, unitCost: 0 } })
  const totals = invoiceTotals(lines, effectiveCharges)
  const filtered = products.filter(product => (filter === 'All' || (filter === 'Services' ? product.service : !product.service)) && `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase()))
  function quantity(id: string, next: number) { setCart(current => next < 1 ? current.filter(line => line.id !== id) : current.some(line => line.id === id) ? current.map(line => line.id === id ? { ...line, quantity: next } : line) : [...current, { id, quantity: next }]); setError('') }
  async function checkout() {
    if (submitting.current) return
    submitting.current = true; setBusy(true); setError('')
    try {
      const result = await workspace.checkout({ customer, contact, channel, cashTendered, paymentMethod: method, paid: Number(paid), lines: cart, fulfillment: { mode: fulfillment, address, distanceKm: Number(distance) }, bundleId: bundleName ? bundleId : undefined, pcSet: !!bundleName && pcSet, charges: effectiveCharges, notes })
      setCheckoutOpen(false); setSale(result); setCart([]); setPaid('0'); setCashTendered(undefined); setBundleId(undefined); setPcSet(false)
    } catch (err) { setError((err as Error).message) }
    finally { submitting.current = false; setBusy(false) }
  }
  return <>
    <PageHeader eyebrow={customerMode ? 'SHOP ONLINE' : 'WORKSHOP CHECKOUT'} title={customerMode ? 'Shop & order' : 'Point of sale'} description={customerMode ? 'Choose in-stock products and services. Pay at the workshop.' : 'One checkout for walk-in customers and online orders.'}><button className="secondary-button" onClick={() => setBundlesOpen(true)} title="Bundles & PC sets" aria-label="Bundles & PC sets"><Boxes size={20} /></button></PageHeader>
    <div className="list-toolbar pos-toolbar"><SearchField label="Search products and services" value={query} onChange={setQuery} /><select aria-label="Product type" value={filter} onChange={e => setFilter(e.target.value)}><option>All</option><option>Products</option><option>Services</option></select></div><div className="pos-layout"><div>
      <div className="pos-products">{filtered.map(product => <article className="pos-product" key={product.id}><span className="service-icon">{product.service ? <BrushCleaning size={23} /> : <Package size={23} />}</span><h2>{product.name}</h2><p>{product.service ? 'Workshop service' : `${product.stock} in stock`}</p><strong>{product.price === null ? 'Price not set' : formatPHP(product.price)}</strong><button className="secondary-button" disabled={product.price === null || product.stock <= (cart.find(line => line.id === product.id)?.quantity ?? 0)} onClick={() => quantity(product.id, (cart.find(line => line.id === product.id)?.quantity ?? 0) + 1)} aria-label={`Add ${product.name}`}><Plus size={20} /></button>{!product.service && <button className="icon-button product-inspect" title={"View " + product.name} aria-label={"View " + product.name} onClick={() => setProductDetail(workspace.inventory.find(item => item.id === product.id)!)}><Eye size={19}/></button>}</article>)}</div>
      {!filtered.length && <div className="empty-state"><Package size={26} /><h3>No matching products</h3><p>{customerMode ? 'The workshop has not added matching stock yet.' : 'Add inventory to make products available here.'}</p></div>}
    </div><Panel title="Current order" action={<ShoppingCart size={22} />}><div className="order-body">      <div className="cart-lines">{cart.length ? cart.map(line => {
        const item = products.find(item => item.id === line.id)
        return <div className="cart-line" key={line.id}><div><strong>{item?.name ?? 'Unavailable item'}</strong><small>{formatPHP(item?.price ?? 0)} each</small></div><div className="quantity-controls"><button type="button" className="icon-button" aria-label={`Decrease ${item?.name}`} onClick={() => quantity(line.id, line.quantity - 1)}><Minus size={14} /></button><span>{line.quantity}</span><button type="button" className="icon-button" aria-label={`Increase ${item?.name}`} disabled={!item || line.quantity >= item.stock} onClick={() => quantity(line.id, line.quantity + 1)}><Plus size={14} /></button><button type="button" className="icon-button" aria-label={`Remove ${item?.name}`} onClick={() => quantity(line.id, 0)}><Trash2 size={15} /></button></div></div>
      }) : <p className="storage-caption">Add products or services to start an order.</p>}</div>
<div className="order-summary"><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span><strong>{formatPHP(totals.total)}</strong></div>{bundleName && <p className="storage-caption">{bundleName} / Free delivery</p>}<button className="primary-button" disabled={!cart.length} onClick={() => { setError(''); setCheckoutOpen(true) }} title="Review checkout" aria-label="Review checkout"><ArrowRight size={20} /></button></div></Panel></div>
    {checkoutOpen && <Dialog title={customerMode ? 'Review your order' : 'Checkout'} wide onClose={() => { if (!busy) setCheckoutOpen(false) }}><div className="checkout-layout"><div className="portal-form settings-fields">
      {!customerMode && <label>Order channel<select aria-label="Order channel" value={channel} onChange={e => setChannel(e.target.value as typeof channel)}><option>Walk-in</option><option>Online</option></select></label>}
      <label>Customer name<input maxLength={100} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Enter customer name" /></label><label>Customer contact<input maxLength={200} value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone or email" /></label>
      {!customerMode && <details className="charge-details"><summary>Charges, discount & tax</summary><label>Fee or deduction preset<select value="" onChange={e => { const preset = directory.fees.find(item => item.id === e.target.value); if (preset) setCharges({ ...charges, [preset.kind]: preset.value, ...(preset.kind === "other" ? { otherLabel: preset.name } : {}) }) }}><option value="">Apply a directory preset</option>{directory.fees.map(fee => <option key={fee.id} value={fee.id}>{fee.name} / {fee.value}{fee.kind === "taxRate" ? "%" : " PHP"}</option>)}</select></label><div className="portal-form-grid">{(['labor', 'other', 'discount', 'taxRate'] as const).map(field => <label key={field}>{{ labor: 'Labor (PHP)', delivery: 'Delivery (PHP)', other: 'Other charges (PHP)', discount: 'Discount (PHP)', taxRate: 'Tax (%)' }[field]}<input type="number" min="0" step="0.01" max={field === 'taxRate' ? 100 : undefined} value={charges[field]} onChange={e => setCharges({ ...charges, [field]: Number(e.target.value) })} /></label>)}</div><label>Other charge description<input value={charges.otherLabel} maxLength={100} onChange={e => setCharges({ ...charges, otherLabel: e.target.value })} /></label></details>}
      <label>Fulfillment<select aria-label="Fulfillment" value={fulfillment} onChange={e => setFulfillment(e.target.value as typeof fulfillment)}><option>Pickup</option><option>Delivery</option></select></label>
      {fulfillment === 'Delivery' && <><label>Delivery address<textarea value={address} maxLength={400} rows={2} onChange={e => setAddress(e.target.value)} /></label><label>One-way road distance (km)<input type="number" min="0.1" step="0.1" value={distance} onChange={e => setDistance(e.target.value)} /></label><p className="storage-caption">Distance from the workshop, subject to confirmation.</p></>}
      {(bundleId || pcSet) && !bundleName && cart.length > 0 && <p className="fulfillment-note">The bundle is incomplete. Standard delivery charges apply until all bundle items are restored.</p>}
      {bundleName && <p className="fulfillment-note">{bundleName}: free delivery guaranteed while the full set remains in your cart.</p>}
      {fulfillment === 'Delivery' && deliveryFee === null && <p role="status" className="fulfillment-note">Delivery quote required. Enter a distance and configure transport rates before checkout, or choose pickup.</p>}
      <details className="warranty-details"><summary>Item warranty policy</summary><p className="storage-caption">Item warranty: {shop.warrantyMonths === '' ? 'duration pending workshop confirmation' : shop.warrantyMonths + ' months by default'}. {shop.warrantyTerms || 'Warranty terms will be confirmed by the workshop.'} Each purchased item keeps its own warranty record on the invoice.</p></details>
</div><div className="portal-form settings-fields checkout-review">      <dl className="checkout-totals">{[['Items', totals.subtotal], ['Labor', effectiveCharges.labor], ['Delivery', effectiveCharges.delivery], [effectiveCharges.otherLabel || 'Other charges', effectiveCharges.other], ['Discount', -effectiveCharges.discount], [`Tax (${effectiveCharges.taxRate}%)`, totals.tax], ['Total', totals.total]].map(([label, amount], index) => <div key={index}><dt>{label}</dt><dd>{formatPHP(Number(amount))}</dd></div>)}</dl>
      {!customerMode && <div className="portal-form-grid"><label>Payment method<select value={method} onChange={e => setMethod(e.target.value)}>{directory.payments.map(value => <option key={value}>{value}</option>)}</select></label><label>Amount received (PHP)<input type="number" min="0" step="0.01" value={paid} onChange={e => { setPaid(e.target.value); setCashTendered(undefined) }} /></label><button type="button" className="text-button" onClick={() => { setPaid(String(Math.max(0, totals.total))); setCashTendered(undefined) }} title="Mark fully paid" aria-label="Mark fully paid"><CreditCard size={20}/></button><button type="button" className="icon-button" title="Payment calculator" aria-label="Payment calculator" onClick={() => setCalculatorOpen(true)}><Calculator size={22}/></button>{cashTendered !== undefined && <p className="payment-change">Tendered {formatPHP(cashTendered)} / Change {formatPHP(Math.max(0, cashTendered-Number(paid)))}</p>}</div>}
      <label>Order notes<textarea rows={2} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="primary-button" disabled={busy || !cart.length || (fulfillment === 'Delivery' && deliveryFee === null)} onClick={checkout} title={customerMode ? "Place local order" : "Complete sale"} aria-label={busy ? "Saving..." : customerMode ? "Place local order" : "Complete sale"}>{busy ? <LoaderCircle className="loading-icon" size={18} /> : <CreditCard size={18} />}</button>
      <p className="storage-caption">{customerMode ? 'Local order with your chosen fulfillment. No online payment is collected. Orders are visible in this browser only.' : 'Completing a sale deducts stock and creates an itemized invoice.'}</p>
    </div></div></Dialog>}
    {bundlesOpen && <Dialog title="Bundles & PC sets" wide onClose={() => setBundlesOpen(false)}><BundleCatalog onSelect={bundle => { if (cart.length && !window.confirm('Replace the current cart with this bundle?')) return; setCart(bundle.items.map(item => ({ id: item.inventoryId, quantity: item.quantity }))); setBundleId(bundle.id); setPcSet(false); setError(''); setBundlesOpen(false) }} /></Dialog>}
    {calculatorOpen && <PaymentCalculator total={Math.max(0,totals.total)} onClose={() => setCalculatorOpen(false)} onApply={(amount,tender) => { setPaid(String(amount)); setCashTendered(tender); setMethod("Cash") }}/>}
    {productDetail && <ProductDialog item={productDetail} onClose={() => setProductDetail(null)}/>}
    {sale && <InvoiceDialog sale={sale} onClose={() => setSale(null)} />}
  </>
}
