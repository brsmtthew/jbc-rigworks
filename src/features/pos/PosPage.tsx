import { useDirectories } from '../../lib/directories'
import { Eye } from 'lucide-react'
import { ProductDialog } from '../inventory/ProductDialog'
import { Dialog } from '../../components/ui/Dialog'
import { BundleCatalog } from './BundleCatalog'
import { qualifyingBundle, transportation } from '../../lib/fulfillment'
import { useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Banknote, Boxes, ArrowRight, CreditCard, LoaderCircle, Minus, Package, Plus, ShoppingCart, BrushCleaning, Trash2, ReceiptText } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SearchField } from '../../components/ui/Filters'
import { useWorkspace } from '../../lib/workspaceStorage'
import { useAuth } from '../../lib/auth-context'
import { accountKey, defaultAccount, useShopSettings, useStoredValue } from '../../lib/preferences'
import { isPcPart, isSellable, tiers } from '../../lib/pc'
import { invoiceTotals } from '../../lib/commerce'
import { formatPHP } from '../../data/appData'
import { InvoiceDialog } from '../sales/InvoiceDialog'
import type { Sale, InventoryItem, Job } from '../../types/business'
import { useConfirmation } from '../../components/ui/confirmation-context'

type PosProduct = { id: string; name: string; category: string; price: number | null; stock: number; service: boolean; item?: InventoryItem }

export function PosPage() {
  const [directory] = useDirectories()
  const [productDetail, setProductDetail] = useState<InventoryItem | null>(null)
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const customerMode = user?.role === 'customer'
  const workspace = useWorkspace()
  const location = useLocation()
  const [shop] = useShopSettings()
  const [profile] = useStoredValue(accountKey(user!.id), defaultAccount)
  const [params] = useSearchParams()
  const jobDraft = location.state?.job as Job | undefined
  const collectSaleId = typeof location.state?.collectSaleId === 'string' ? location.state.collectSaleId : null
  const [collectingSaleMode, setCollectingSaleMode] = useState(collectSaleId)
  const collectingSale = collectingSaleMode ? workspace.sales.find(item => item.id === collectingSaleMode) : undefined
  const [cashReceived, setCashReceived] = useState('')
  const [jobService] = useState(() => jobDraft ? { id: `job-service:${jobDraft.id}`, description: `${jobDraft.device} / ${jobDraft.service}`, unitPrice: jobDraft.quote } : undefined)
  const customServices = jobService ? [jobService] : []
  const products: PosProduct[] = [
    ...workspace.inventory.filter(item => isSellable(item) && (!customerMode || (isPcPart(item) && item.stock > 0))).map(item => ({ id: item.id, name: item.brand ? `${item.brand} ${item.model || item.name}` : item.model || item.name, category: item.category, price: item.price, stock: item.stock, service: false, item })),
    ...(!customerMode ? [...(['Desktop', 'Laptop'] as const).flatMap(device => tiers.map(tier => ({ id: `clean:${device}:${tier}`, name: `${device} deep clean - ${tier} specs`, category: 'Services', price: shop.cleaning[device][tier] === '' ? null : Number(shop.cleaning[device][tier]), stock: Infinity, service: true }))), ...(jobService ? [{ ...jobService, name: jobService.description, category: 'Service jobs', price: jobService.unitPrice, stock: 1, service: true }] : [])] : []),
  ]
  const [cart, setCart] = useState<{ id: string; quantity: number }[]>(() => {
    if (jobService) return [{ id: jobService.id, quantity: 1 }]
    const parts = location.state?.parts as string[] | undefined
    if (Array.isArray(parts)) return [...new Set(parts)].map(id => ({ id, quantity: 1 }))
    const service = customerMode ? null : params.get('service')
    return service ? [{ id: service, quantity: 1 }] : []
  })
  const [bundleId, setBundleId] = useState<string | undefined>()
  const [pcSet, setPcSet] = useState(Boolean(location.state?.pcSet))
  const [fulfillment, setFulfillment] = useState<'Pickup' | 'Delivery'>('Pickup')
  const [address, setAddress] = useState(profile.address), [distance, setDistance] = useState('')
  const bundleName = qualifyingBundle(cart, workspace.inventory, workspace.bundles, bundleId, pcSet)
  const deliveryFee = fulfillment === 'Pickup' || bundleName ? 0 : distance === '' ? null : transportation(shop, Number(distance))
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All')
  const [customer, setCustomer] = useState(customerMode ? profile.name || user!.name : jobDraft?.customer ?? '')
  const [contact, setContact] = useState(customerMode ? [profile.phone, profile.contactEmail || user!.email].filter(Boolean).join(' / ') : '')
  const [channel, setChannel] = useState<'Walk-in' | 'Online'>(customerMode ? 'Online' : 'Walk-in')
  const [method, setMethod] = useState('Cash'), [paid, setPaid] = useState(() => collectingSale ? String(Math.max(0, collectingSale.total - collectingSale.paid)) : '0'), [notes, setNotes] = useState('')
  const [charges, setCharges] = useState({ labor: shop.labor, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: shop.taxRate })
  const [sale, setSale] = useState<Sale | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false), [bundlesOpen, setBundlesOpen] = useState(false)
  const submitting = useRef(false)
  const baseCharges = customerMode ? { labor: shop.labor, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: shop.taxRate } : jobService ? { ...charges, labor: 0 } : charges
  const effectiveCharges = { ...baseCharges, delivery: deliveryFee ?? 0 }
  const lines = cart.map(line => { const product = products.find(product => product.id === line.id); return { ...line, description: product?.name ?? 'Unavailable item', unitPrice: product?.price ?? 0, unitCost: 0 } })
  const totals = cart.length ? invoiceTotals(lines, effectiveCharges) : { subtotal: 0, tax: 0, total: 0 }
  const receivedCash = cashReceived.trim() ? Number(cashReceived) : 0
  const cashPaid = Number.isFinite(receivedCash) ? Math.min(Math.max(0, receivedCash), totals.total) : 0
  const collectBalance = collectingSale ? Math.max(0, collectingSale.total - collectingSale.paid) : 0
  const collectionCashPaid = Number.isFinite(receivedCash) ? Math.min(Math.max(0, receivedCash), collectBalance) : 0
  const checkoutPaid = method === 'Cash' ? cashPaid : Number(paid)
  const filtered = products.filter(product => (filter === 'All' || (filter === 'Services' ? product.service : !product.service)) && `${product.name} ${product.category} ${product.item?.brand || ''} ${product.item?.model || ''} ${product.item?.specs || ''}`.toLowerCase().includes(query.toLowerCase()))
  function quantity(id: string, next: number) { setCart(current => next < 1 ? current.filter(line => line.id !== id) : current.some(line => line.id === id) ? current.map(line => line.id === id ? { ...line, quantity: next } : line) : [...current, { id, quantity: next }]); setError('') }
  async function checkout() {
    if (submitting.current) return
    submitting.current = true; setError('')
    try {
      if (!await confirm({ title: customerMode ? 'Place this order?' : 'Complete this sale?', message: `${customerMode ? 'Save this order' : 'Complete this sale'} for ${formatPHP(totals.total)}?`, confirmLabel: customerMode ? 'Place local order' : 'Complete sale' })) return
      setBusy(true)
      const result = await workspace.checkout({ customer, contact, channel, cashTendered: method === 'Cash' && cashReceived.trim() ? receivedCash : undefined, paymentMethod: method, paid: checkoutPaid, lines: cart, customServices, jobId: jobService ? jobDraft?.id : undefined, fulfillment: { mode: fulfillment, address, distanceKm: Number(distance) }, bundleId: bundleName ? bundleId : undefined, pcSet: !!bundleName && pcSet, charges: effectiveCharges, notes })
      setCheckoutOpen(false); setSale(result); setCart([]); setPaid('0'); setCashReceived(''); setBundleId(undefined); setPcSet(false)
    } catch (err) { setError((err as Error).message) }
    finally { submitting.current = false; setBusy(false) }
  }
  async function selectBundle(bundle: import('../../types/business').ProductBundle) {
    if (cart.length && !await confirm({ title: 'Replace current order?', message: 'Choosing this bundle will replace the items in your current order.', confirmLabel: 'Replace order', tone: 'danger' })) return
    setCart(bundle.items.map(item => ({ id: item.inventoryId, quantity: item.quantity }))); setBundleId(bundle.id); setPcSet(false); setError(''); setBundlesOpen(false)
  }
  async function collectOutstanding() {
    if (!collectingSale) { setError('This invoice is unavailable. Return to Sales and open it again.'); return }
    const amount = method === 'Cash' ? collectionCashPaid : Number(paid)
    if (!Number.isFinite(amount) || amount <= 0 || amount > collectBalance) { setError('Enter a payment greater than zero and no more than the balance due.'); return }
    if (!await confirm({ title: 'Record payment?', message: `Record ${formatPHP(amount)} against invoice ${collectingSale.id}?`, confirmLabel: 'Record payment' })) return
    try {
      const updated = await workspace.collectPayment(collectingSale.id, amount, method, method === 'Cash' && cashReceived.trim() ? receivedCash : undefined)
      setSale(updated); setCollectingSaleMode(null); setError('')
    } catch (err) { setError((err as Error).message) }
  }
  function setQuickCash(amount: number) { setCashReceived(String(Math.round(amount * 100) / 100)) }
  function setPaymentMethod(next: string) {
    if (next !== 'Cash' && method === 'Cash' && cashReceived.trim()) setPaid(String(collectingSaleMode ? collectionCashPaid : cashPaid))
    if (next === 'Cash' && method !== 'Cash' && Number(paid) > 0) setCashReceived(paid)
    setMethod(next)
  }
  const cashShortcuts = (amount: number) => [...new Set([amount, Math.ceil(amount / 20) * 20, Math.ceil(amount / 100) * 100, Math.ceil(amount / 500) * 500])].filter(value => value > 0 && Number.isFinite(value))

  if (collectingSaleMode) return <>
    <PageHeader eyebrow="CASHIER" title="Collect payment" description="Record a payment against an existing POS invoice."><Link className="secondary-button" to="/sales">Back to sales</Link></PageHeader>
    {collectingSale ? <div className="cashier-screen">
      <Panel title={`Invoice ${collectingSale.id}`} subtitle={collectingSale.customer}>
        <div className="cashier-invoice-summary"><span>Invoice total<strong>{formatPHP(collectingSale.total)}</strong></span><span>Paid so far<strong>{formatPHP(collectingSale.paid)}</strong></span><span>Balance due<strong>{formatPHP(collectBalance)}</strong></span></div>
        <div className="cashier-sale-lines">{collectingSale.lines?.length ? collectingSale.lines.map(line => <div key={line.id}><span>{line.quantity} × {line.description}</span><strong>{formatPHP(line.quantity * line.unitPrice)}</strong></div>) : <p>{collectingSale.detail}</p>}</div>
      </Panel>
      <Panel title="Payment" subtitle="Enter the amount received and return the correct change.">
        <div className="cashier-form portal-form settings-fields">
          <label>Payment method<select value={method} onChange={event => setPaymentMethod(event.target.value)}>{directory.payments.map(value => <option key={value}>{value}</option>)}</select></label>
          {method === 'Cash' ? <>
            <label>Cash received (PHP)<input autoFocus inputMode="decimal" type="number" min="0" step="0.01" value={cashReceived} onChange={event => setCashReceived(event.target.value)} /></label>
            <div className="cashier-quick"><span>Quick cash</span>{cashShortcuts(collectBalance).map((value, index) => <button type="button" className="secondary-button" key={`${value}-${index}`} onClick={() => setQuickCash(value)}>{index === 0 ? 'Exact' : formatPHP(value)}</button>)}</div>
          </> : <label>Payment amount (PHP)<input autoFocus inputMode="decimal" type="number" min="0" max={collectBalance} step="0.01" value={paid} onChange={event => setPaid(event.target.value)} /></label>}
          <dl className="checkout-totals cashier-totals"><div><dt>Applying now</dt><dd>{formatPHP(method === 'Cash' ? collectionCashPaid : Number(paid) || 0)}</dd></div>{method === 'Cash' && <div><dt>Change to return</dt><dd>{formatPHP(Math.max(0, receivedCash - collectionCashPaid))}</dd></div>}<div><dt>Balance after payment</dt><dd>{formatPHP(Math.max(0, collectBalance - (method === 'Cash' ? collectionCashPaid : Number(paid) || 0)))}</dd></div></dl>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary-button cashier-submit" disabled={collectBalance <= 0} onClick={collectOutstanding}><Banknote size={18} />Record payment</button>
        </div>
      </Panel>
    </div> : <div className="empty-state"><ReceiptText size={28}/><h3>Invoice unavailable</h3><p>Return to Sales and open the invoice again.</p><Link className="secondary-button" to="/sales">Back to sales</Link></div>}
    {sale && <InvoiceDialog sale={sale} onClose={() => setSale(null)} />}
  </>;
  return <>
    <PageHeader eyebrow={customerMode ? 'PC PARTS SHOP' : 'WORKSHOP CHECKOUT'} title={customerMode ? 'Shop PC parts' : 'Point of sale'} description={customerMode ? 'Browse available components with their models, specs, and prices.' : 'One checkout for walk-in customers and online orders.'}>{!customerMode && <button className="secondary-button" onClick={() => setBundlesOpen(true)}><Boxes size={18} />Bundles & PC sets</button>}</PageHeader>
    <div className="list-toolbar pos-toolbar"><SearchField label={customerMode ? 'Search PC parts' : 'Search products and services'} value={query} onChange={setQuery} />{!customerMode && <select aria-label="Product type" value={filter} onChange={e => setFilter(e.target.value)}><option>All</option><option>Products</option><option>Services</option></select>}</div><div className="pos-layout"><div>
      <div className="pos-products">{filtered.map(product => <article className="pos-product" key={product.id}><span className="service-icon">{product.service ? <BrushCleaning size={23} /> : <Package size={23} />}</span><h2>{product.name}</h2><p>{product.service ? 'Workshop service' : `${product.item?.brand ? product.item.brand + (product.item.model ? ` / ${product.item.model}` : '') + ' · ' : ''}${product.stock} in stock`}</p>{product.item?.specs && <p className="shop-card-specs">{product.item.specs}</p>}<strong>{product.price === null ? 'Price not set' : formatPHP(product.price)}</strong><button className="secondary-button" disabled={product.price === null || product.stock <= (cart.find(line => line.id === product.id)?.quantity ?? 0)} onClick={() => quantity(product.id, (cart.find(line => line.id === product.id)?.quantity ?? 0) + 1)} aria-label={`Add ${product.name}`}><Plus size={20} /></button>{!product.service && <button className="icon-button product-inspect" title={"View specs for " + product.name} aria-label={"View specs for " + product.name} onClick={() => setProductDetail(product.item!)}><Eye size={19}/><span className="visually-hidden">View specs</span></button>}</article>)}</div>
      {!filtered.length && <div className="empty-state"><Package size={26} /><h3>No matching products</h3><p>{customerMode ? 'The workshop has not added matching stock yet.' : 'Add inventory to make products available here.'}</p></div>}
    </div><Panel title="Current order" action={<ShoppingCart size={22} />}><div className="order-body">      <div className="cart-lines">{cart.length ? cart.map(line => {
        const item = products.find(item => item.id === line.id)
        return <div className="cart-line" key={line.id}><div><strong>{item?.name ?? 'Unavailable item'}</strong><small>{formatPHP(item?.price ?? 0)} each</small></div><div className="quantity-controls"><button type="button" className="icon-button" aria-label={`Decrease ${item?.name}`} onClick={() => quantity(line.id, line.quantity - 1)}><Minus size={14} /></button><span>{line.quantity}</span><button type="button" className="icon-button" aria-label={`Increase ${item?.name}`} disabled={!item || line.quantity >= item.stock} onClick={() => quantity(line.id, line.quantity + 1)}><Plus size={14} /></button><button type="button" className="icon-button" aria-label={`Remove ${item?.name}`} onClick={() => quantity(line.id, 0)}><Trash2 size={15} /></button></div></div>
    }) : <p className="storage-caption">Add products or services to start an order.</p>}</div>
{cart.length > 0 && <><div className="order-summary"><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span><strong>{formatPHP(totals.total)}</strong></div>{bundleName && <p className="storage-caption">{bundleName} / Free delivery</p>}<button className="primary-button" onClick={() => { setError(''); setCheckoutOpen(true) }}><ArrowRight size={18} />Review checkout</button></>}</div></Panel></div>
    {checkoutOpen && <Dialog title={customerMode ? 'Review your order' : 'Checkout'} wide onClose={() => { if (!busy) setCheckoutOpen(false) }}><div className="checkout-layout"><div className="portal-form settings-fields">
      {!customerMode && <label>Order channel<select aria-label="Order channel" value={channel} onChange={e => setChannel(e.target.value as typeof channel)}><option>Walk-in</option><option>Online</option></select></label>}
      <label>Customer name<input maxLength={100} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Enter customer name" /></label><label>Customer contact<input maxLength={200} value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone or email" /></label>
      {!customerMode && <details className="charge-details"><summary>Charges, discount & tax</summary><label>Fee or deduction preset<select value="" onChange={e => { const preset = directory.fees.find(item => item.id === e.target.value); if (preset) setCharges({ ...charges, [preset.kind]: preset.value, ...(preset.kind === "other" ? { otherLabel: preset.name } : {}) }) }}><option value="">Apply a directory preset</option>{directory.fees.map(fee => <option key={fee.id} value={fee.id}>{fee.name} / {fee.value}{fee.kind === "taxRate" ? "%" : " PHP"}</option>)}</select></label><div className="portal-form-grid">{(['labor', 'other', 'discount', 'taxRate'] as const).map(field => <label key={field}>{{ labor: 'Labor (PHP)', delivery: 'Delivery (PHP)', other: 'Other charges (PHP)', discount: 'Discount (PHP)', taxRate: 'Tax (%)' }[field]}<input type="number" min="0" step="0.01" max={field === 'taxRate' ? 100 : undefined} value={charges[field]} onChange={e => setCharges({ ...charges, [field]: Number(e.target.value) })} /></label>)}</div><label>Other charge description<input value={charges.otherLabel} maxLength={100} onChange={e => setCharges({ ...charges, otherLabel: e.target.value })} /></label></details>}
      {jobService ? <p className="fulfillment-note">Service jobs are collected at the workshop counter.</p> : <label>Fulfillment<select aria-label="Fulfillment" value={fulfillment} onChange={e => setFulfillment(e.target.value as typeof fulfillment)}><option>Pickup</option><option>Delivery</option></select></label>}
      {fulfillment === 'Delivery' && <><label>Delivery address<textarea value={address} maxLength={400} rows={2} onChange={e => setAddress(e.target.value)} /></label><label>One-way road distance (km)<input type="number" min="0.1" step="0.1" value={distance} onChange={e => setDistance(e.target.value)} /></label><p className="storage-caption">Distance from the workshop, subject to confirmation.</p></>}
      {(bundleId || pcSet) && !bundleName && cart.length > 0 && <p className="fulfillment-note">The bundle is incomplete. Standard delivery charges apply until all bundle items are restored.</p>}
      {bundleName && <p className="fulfillment-note">{bundleName}: free delivery guaranteed while the full set remains in your cart.</p>}
      {fulfillment === 'Delivery' && deliveryFee === null && <p role="status" className="fulfillment-note">Delivery quote required. Enter a distance and configure transport rates before checkout, or choose pickup.</p>}
      <details className="warranty-details"><summary>Item warranty policy</summary><p className="storage-caption">Item warranty: {shop.warrantyMonths === '' ? 'duration pending workshop confirmation' : shop.warrantyMonths + ' months by default'}. {shop.warrantyTerms || 'Warranty terms will be confirmed by the workshop.'} Each purchased item keeps its own warranty record on the invoice.</p></details>
</div><div className="portal-form settings-fields checkout-review">      <dl className="checkout-totals">{[['Items', totals.subtotal], ['Labor', effectiveCharges.labor], ['Delivery', effectiveCharges.delivery], [effectiveCharges.otherLabel || 'Other charges', effectiveCharges.other], ['Discount', -effectiveCharges.discount], [`Tax (${effectiveCharges.taxRate}%)`, totals.tax], ['Total', totals.total]].map(([label, amount], index) => <div key={index}><dt>{label}</dt><dd>{formatPHP(Number(amount))}</dd></div>)}</dl>
      {!customerMode && <section className="cashier-panel" aria-label="Cashier payment controls">
        <div className="cashier-panel-heading"><span className="service-icon"><Banknote size={21}/></span><span><strong>Cashier</strong><small>Record what the customer hands over</small></span></div>
        <label>Payment method<select value={method} onChange={event => setPaymentMethod(event.target.value)}>{directory.payments.map(value => <option key={value}>{value}</option>)}</select></label>
        {method === 'Cash' ? <>
          <label>Amount received (PHP)<input inputMode="decimal" type="number" min="0" step="0.01" value={cashReceived} onChange={event => setCashReceived(event.target.value)} placeholder="Enter cash received" /></label>
          <div className="cashier-quick"><span>Quick amount</span>{cashShortcuts(totals.total).map((value, index) => <button type="button" className="secondary-button" key={`${value}-${index}`} onClick={() => setQuickCash(value)}>{index === 0 ? 'Exact' : formatPHP(value)}</button>)}</div>
          <dl className="checkout-totals cashier-totals"><div><dt>Amount applied</dt><dd>{formatPHP(cashPaid)}</dd></div><div><dt>Change to return</dt><dd>{formatPHP(Math.max(0, receivedCash - cashPaid))}</dd></div><div><dt>Balance after payment</dt><dd>{formatPHP(Math.max(0, totals.total - cashPaid))}</dd></div></dl>
        </> : <label>Amount received (PHP)<input inputMode="decimal" type="number" min="0" max={totals.total} step="0.01" value={paid} onChange={event => setPaid(event.target.value)} /></label>}
      </section>}
      <label>Order notes<textarea rows={2} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <p className="storage-caption">{customerMode ? 'Local order with your chosen fulfillment. No online payment is collected. Orders are visible in this browser only.' : 'Completing a sale deducts stock and creates an itemized invoice.'}</p>
      <div className="dialog-actions"><button className="primary-button" disabled={busy || !cart.length || (fulfillment === 'Delivery' && deliveryFee === null)} onClick={checkout}>{busy ? <LoaderCircle className="loading-icon" size={18} /> : customerMode ? <CreditCard size={18} /> : <Banknote size={18} />}{busy ? 'Saving…' : customerMode ? 'Place local order' : 'Complete sale'}</button></div>
    </div></div></Dialog>}
    {bundlesOpen && <Dialog title="Bundles & PC sets" wide onClose={() => setBundlesOpen(false)}><BundleCatalog onSelect={selectBundle} /></Dialog>}
    {productDetail && <ProductDialog item={productDetail} onClose={() => setProductDetail(null)}/>}
    {sale && <InvoiceDialog sale={sale} onClose={() => setSale(null)} />}
  </>
}
