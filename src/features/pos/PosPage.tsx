import { useDirectories } from '../../lib/directories'
import { Eye, ScanLine } from 'lucide-react'
import { getDocFromServer } from 'firebase/firestore'
import { recordRef } from '../../lib/database'
import { rejectPaymentProof, usePaymentProofs } from '../../lib/payments'
import { OrderScanner } from './OrderScanner'
import { ProductDialog } from '../inventory/ProductDialog'
import { Dialog } from '../../components/ui/Dialog'
import { BundleCatalog } from './BundleCatalog'
import { qualifyingBundle, transportation } from '../../lib/fulfillment'
import { useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Banknote, Boxes, ArrowRight, LoaderCircle, Minus, Package, Plus, ShoppingCart, BrushCleaning, Trash2, ReceiptText } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SearchField } from '../../components/ui/Filters'
import { useWorkspace } from '../../lib/workspaceStorage'
import { useAuth } from '../../lib/auth-context'
import { accountKey, defaultAccount, useShopSettings, useStoredValue } from '../../lib/preferences'
import { isPcPart, isSellable, tiers } from '../../lib/pc'
import { invoiceTotals, money } from '../../lib/commerce'
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
  const customerMode = user?.role === 'user'
  const workspace = useWorkspace()
  const location = useLocation()
  const [shop] = useShopSettings()
  const [profile] = useStoredValue(accountKey(user!.id), defaultAccount)
  const [params] = useSearchParams()
  const jobDraft = location.state?.job as Job | undefined
  const collectSaleId = typeof location.state?.collectSaleId === 'string' ? location.state.collectSaleId : null
  const [collectingSaleMode, setCollectingSaleMode] = useState(collectSaleId)
  const [scannerOpen, setScannerOpen] = useState(false), [scannedOrder, setScannedOrder] = useState<Sale | null>(null)
  const collectingSale = collectingSaleMode ? workspace.sales.find(item => item.id === collectingSaleMode) || workspace.orders.find(item => item.id === collectingSaleMode) || (scannedOrder?.id === collectingSaleMode ? scannedOrder : undefined) : undefined
  const needsProcessing = !!collectingSale?.customerId && !workspace.sales.some(item => item.id === collectingSaleMode)
  const proofs = usePaymentProofs(user?.role === 'admin' ? user : null)
  const pendingProof = proofs.rows.find(proof => proof.orderId === collectingSaleMode && proof.status === 'Pending')
  const [reviewNote, setReviewNote] = useState('')
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
  const [addressChoice, setAddress] = useState<string | null>(null), [distance, setDistance] = useState('')
  const address = addressChoice ?? profile.address
  const bundleName = qualifyingBundle(cart, workspace.inventory, workspace.bundles, bundleId, pcSet)
  const deliveryFee = fulfillment === 'Pickup' || bundleName ? 0 : distance === '' ? null : transportation(shop, Number(distance))
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All')
  const [customerChoice, setCustomer] = useState<string | null>(null)
  const customer = customerChoice ?? (customerMode ? profile.name || user!.name : jobDraft?.customer ?? '')
  const [contactChoice, setContact] = useState<string | null>(null)
  const contact = contactChoice ?? (customerMode ? [profile.phone, profile.contactEmail || user!.email].filter(Boolean).join(' / ') : '')
  const [channel, setChannel] = useState<'Walk-in' | 'Online'>(customerMode ? 'Online' : 'Walk-in')
  const [notes, setNotes] = useState('')
  const [receiptEmailChoice, setReceiptEmail] = useState<string | null>(null)
  const receiptEmail = receiptEmailChoice ?? collectingSale?.receiptEmail ?? (customerMode ? profile.contactEmail || user!.email : '')
  const [chargeChoice, setCharges] = useState<Partial<{ labor: number; delivery: number; other: number; otherLabel: string; discount: number; taxRate: number }>>({})
  const charges = { labor: shop.labor, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: shop.taxRate, ...chargeChoice }
  const [sale, setSale] = useState<Sale | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false), [bundlesOpen, setBundlesOpen] = useState(false)
  const submitting = useRef(false)
  const baseCharges = customerMode ? { labor: shop.labor, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: shop.taxRate } : jobService ? { ...charges, labor: 0 } : charges
  const effectiveCharges = { ...baseCharges, delivery: deliveryFee ?? 0 }
  const lines = cart.map(line => { const product = products.find(product => product.id === line.id); return { ...line, description: product?.name ?? 'Unavailable item', unitPrice: product?.price ?? 0, unitCost: 0 } })
  const totals = cart.length ? invoiceTotals(lines, effectiveCharges) : { subtotal: 0, tax: 0, total: 0 }
  const receivedCash = cashReceived.trim() ? Number(cashReceived) : 0
  const cashPaid = Number.isFinite(receivedCash) ? Math.min(Math.max(0, receivedCash), totals.total) : 0
  const collectBalance = collectingSale ? money(Math.max(0, collectingSale.total - collectingSale.paid)) : 0
  const collectionCashPaid = Number.isFinite(receivedCash) ? Math.min(Math.max(0, receivedCash), collectBalance) : 0
  const checkoutPaid = customerMode ? 0 : cashPaid
  const filtered = products.filter(product => (filter === 'All' || (filter === 'Services' ? product.service : !product.service)) && `${product.name} ${product.category} ${product.item?.brand || ''} ${product.item?.model || ''} ${product.item?.specs || ''}`.toLowerCase().includes(query.toLowerCase()))
  function quantity(id: string, next: number) { setCart(current => next < 1 ? current.filter(line => line.id !== id) : current.some(line => line.id === id) ? current.map(line => line.id === id ? { ...line, quantity: next } : line) : [...current, { id, quantity: next }]); setError('') }
  async function checkout() {
    if (submitting.current) return
    submitting.current = true; setError('')
    try {
      if (!await confirm({ title: customerMode ? 'Place this order?' : 'Complete this sale?', message: `${customerMode ? 'Send this order' : 'Complete this sale'} for ${formatPHP(totals.total)}?`, confirmLabel: customerMode ? 'Place order' : 'Complete sale' })) return
      setBusy(true)
      const result = await workspace.checkout({ customer, contact, receiptEmail, channel, cashTendered: !customerMode && cashReceived.trim() ? receivedCash : undefined, paymentMethod: 'Cash', paid: checkoutPaid, lines: cart, customServices, jobId: jobService ? jobDraft?.id : undefined, fulfillment: { mode: customerMode ? 'Pickup' : fulfillment, address, distanceKm: Number(distance) }, bundleId: bundleName ? bundleId : undefined, pcSet: !!bundleName && pcSet, charges: effectiveCharges, notes })
      setCheckoutOpen(false); setSale(result); setCart([]); setCashReceived(''); setBundleId(undefined); setPcSet(false)
    } catch (err) { setError((err as Error).message) }
    finally { submitting.current = false; setBusy(false) }
  }
  async function selectBundle(bundle: import('../../types/business').ProductBundle) {
    if (cart.length && !await confirm({ title: 'Replace current order?', message: 'Choosing this bundle will replace the items in your current order.', confirmLabel: 'Replace order', tone: 'danger' })) return
    setCart(bundle.items.map(item => ({ id: item.inventoryId, quantity: item.quantity }))); setBundleId(bundle.id); setPcSet(false); setError(''); setBundlesOpen(false)
  }
  async function collectOutstanding(verifyProof = false) {
    if (submitting.current) return
    if (!collectingSale) { setError('This invoice is unavailable. Return to Sales and open it again.'); return }
    const amount = verifyProof ? pendingProof?.amount ?? 0 : collectionCashPaid
    if (!Number.isFinite(amount) || amount <= 0 || amount > collectBalance) { setError('Enter a payment greater than zero and no more than the balance due.'); return }
    submitting.current = true
    try {
      if (!await confirm({ title: 'Record payment?', message: verifyProof ? `Confirm that ${formatPHP(amount)} with reference ${pendingProof?.reference} was received in the company account? This issues the transaction receipt.` : `Record ${formatPHP(amount)} cash received at the store against ${collectingSale.id}?`, confirmLabel: 'Record payment' })) return
      setBusy(true)
      const updated = await workspace.collectPayment(collectingSale.id, amount, { receiptEmail, verifyProof, cashTendered: !verifyProof && cashReceived.trim() ? receivedCash : undefined })
      setSale(updated); setCashReceived(''); setError('')
    } catch (err) { setError((err as Error).message) }
    finally { submitting.current = false; setBusy(false) }
  }
  function setQuickCash(amount: number) { setCashReceived(String(Math.round(amount * 100) / 100)) }
  async function openScannedOrder(id: string) {
    const [order, invoice] = await Promise.all([getDocFromServer(recordRef('orders', id)), getDocFromServer(recordRef('sales', id))])
    const found = invoice.exists() ? invoice.data() as Sale : order.exists() ? order.data() as Sale : null
    if (!found) throw new Error('No order matches this reference.')
    if (found.orderStatus === 'Declined') throw new Error('This order was declined. Ask the customer to place a new order.')
    setScannedOrder(found); setCollectingSaleMode(id); setScannerOpen(false); setCashReceived(''); setReceiptEmail(null); setReviewNote(''); setError('')
  }
  async function prepareOrder() {
    if (!collectingSale || busy) return
    if (!await confirm({ title: 'Prepare order in POS?', message: 'Check current prices and reserve the ordered stock before recording payment?', confirmLabel: 'Prepare order' })) return
    setBusy(true); setError('')
    try { await workspace.updateOrderStatus(collectingSale.id, 'Processing') }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  async function rejectProof() {
    if (!pendingProof || !user || busy) return
    if (!reviewNote.trim()) { setError('Enter the reason this proof is being rejected.'); return }
    if (!await confirm({ title: 'Reject payment proof?', message: 'The customer can submit a corrected proof or pay cash at the store.', confirmLabel: 'Reject proof' })) return
    setBusy(true); setError('')
    try { await rejectPaymentProof(user, pendingProof.orderId, reviewNote) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  async function confirmPickup() {
    if (!collectingSale || busy) return
    if (!await confirm({ title: 'Confirm pickup?', message: 'Confirm that the customer has received all items in this paid order?', confirmLabel: 'Confirm pickup' })) return
    setBusy(true); setError('')
    try { await workspace.updateOrderStatus(collectingSale.id, 'Completed') }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  const cashShortcuts = (amount: number) => [...new Set([amount, Math.ceil(amount / 20) * 20, Math.ceil(amount / 100) * 100, Math.ceil(amount / 500) * 500])].filter(value => value > 0 && Number.isFinite(value))

  if (collectingSaleMode) return <>
    <PageHeader eyebrow="CASHIER" title="Collect payment" description="Record cash received at the store or verify a submitted transfer."><button className="secondary-button" onClick={() => setScannerOpen(true)}><ScanLine size={18} />Scan order QR</button><Link className="secondary-button" to="/sales">Back to sales</Link></PageHeader>
    {collectingSale ? <div className="cashier-screen">
      <Panel title={`Invoice ${collectingSale.id}`} subtitle={collectingSale.customer}>
        <div className="cashier-invoice-summary"><span>Invoice total<strong>{formatPHP(collectingSale.total)}</strong></span><span>Paid so far<strong>{formatPHP(collectingSale.paid)}</strong></span><span>Balance due<strong>{formatPHP(collectBalance)}</strong></span></div>
        <div className="cashier-sale-lines">{collectingSale.lines?.length ? collectingSale.lines.map(line => <div key={line.id}><span>{line.quantity} × {line.description}</span><strong>{formatPHP(line.quantity * line.unitPrice)}</strong></div>) : <p>{collectingSale.detail}</p>}</div>
      </Panel>
      <Panel title="Payment" subtitle="Enter the amount received and return the correct change.">
        <div className="cashier-form portal-form settings-fields">
          <label>Receipt email<input type="email" maxLength={254} value={receiptEmail} onChange={event => setReceiptEmail(event.target.value)} /></label>
          {needsProcessing && <><p>Review and prepare this order before recording payment.</p><button className="primary-button" disabled={busy} onClick={prepareOrder}>Prepare order in POS</button></>}
          {pendingProof ? <section className="payment-proof-panel portal-form">
            <h3>Transfer proof awaiting verification</h3><p>{pendingProof.method} / {formatPHP(pendingProof.amount)} / Reference {pendingProof.reference}</p>
            <img className="payment-proof-image" src={pendingProof.image} alt="Customer payment proof" />
            <p>Check the amount and reference in the company bank or e-wallet account before recording this payment.</p>
            <button className="primary-button" disabled={busy || needsProcessing || proofs.loading} onClick={() => collectOutstanding(true)}>Verify transfer and issue receipt</button>
            <label>Reason for rejecting proof<textarea rows={2} maxLength={500} value={reviewNote} onChange={event => setReviewNote(event.target.value)} /></label>
            <button className="secondary-button" disabled={busy} onClick={rejectProof}>Reject proof</button>
          </section> : <>
            <p className="fulfillment-note">Payment method: cash received at the store.</p>
            <label>Cash received (PHP)<input autoFocus inputMode="decimal" type="number" min="0" step="0.01" value={cashReceived} onChange={event => setCashReceived(event.target.value)} /></label>
            <div className="cashier-quick"><span>Quick cash</span>{cashShortcuts(collectBalance).map((value, index) => <button type="button" className="secondary-button" key={`${value}-${index}`} onClick={() => setQuickCash(value)}>{index === 0 ? 'Exact' : formatPHP(value)}</button>)}</div>
          <dl className="checkout-totals cashier-totals"><div><dt>Applying now</dt><dd>{formatPHP(collectionCashPaid)}</dd></div><div><dt>Change to return</dt><dd>{formatPHP(Math.max(0, receivedCash - collectionCashPaid))}</dd></div><div><dt>Balance after payment</dt><dd>{formatPHP(Math.max(0, collectBalance - collectionCashPaid))}</dd></div></dl>
          <button className="primary-button cashier-submit" disabled={busy || needsProcessing || proofs.loading || !!proofs.error || collectBalance <= 0} onClick={() => collectOutstanding()}><Banknote size={18} />{busy ? 'Saving…' : 'Record payment'}</button>
          </>}
          {(error || proofs.error) && <p role="alert" className="form-error">{error || proofs.error}</p>}
          {collectBalance <= 0 && <p className="save-message">This order is already paid. No further payment is needed.</p>}
          {collectingSale.customerId && collectBalance <= 0 && !needsProcessing && (collectingSale.orderStatus === 'Completed' ? <p className="save-message">Pickup completed.</p> : <button className="primary-button" disabled={busy} onClick={confirmPickup}>Confirm pickup</button>)}
          <button className="secondary-button" onClick={() => setSale(collectingSale)}>View order QR / receipt</button>
        </div>
      </Panel>
    </div> : <div className="empty-state"><ReceiptText size={28}/><h3>Invoice unavailable</h3><p>Return to Sales and open the invoice again.</p><Link className="secondary-button" to="/sales">Back to sales</Link></div>}
    {sale && <InvoiceDialog sale={sale} onClose={() => setSale(null)} />}
    {scannerOpen && <OrderScanner onSelect={openScannedOrder} onClose={() => setScannerOpen(false)} />}
  </>;
  return <>
    <PageHeader eyebrow={customerMode ? 'PC PARTS SHOP' : 'WORKSHOP CHECKOUT'} title={customerMode ? 'Shop PC parts' : 'Point of sale'} description={customerMode ? 'Place an order, keep its QR, and collect your items at the store.' : 'Scan customer orders and record payments at the counter.'}>{!customerMode && <><button className="secondary-button" onClick={() => setScannerOpen(true)}><ScanLine size={18} />Scan order QR</button><button className="secondary-button" onClick={() => setBundlesOpen(true)}><Boxes size={18} />Bundles & PC sets</button></>}</PageHeader>
    <div className="list-toolbar pos-toolbar"><SearchField label={customerMode ? 'Search PC parts' : 'Search products and services'} value={query} onChange={setQuery} />{!customerMode && <select aria-label="Product type" value={filter} onChange={e => setFilter(e.target.value)}><option>All</option><option>Products</option><option>Services</option></select>}</div><div className="pos-layout"><div>
      <div className="pos-products">{filtered.map(product => <article className="pos-product" key={product.id}><span className="service-icon">{product.service ? <BrushCleaning size={23} /> : <Package size={23} />}</span><h2>{product.name}</h2><p>{product.service ? 'Workshop service' : `${product.item?.brand ? product.item.brand + (product.item.model ? ` / ${product.item.model}` : '') + ' · ' : ''}${product.stock} in stock`}</p>{product.item?.specs && <p className="shop-card-specs">{product.item.specs}</p>}<strong>{product.price === null ? 'Price not set' : formatPHP(product.price)}</strong><button className="secondary-button" disabled={product.price === null || product.stock <= (cart.find(line => line.id === product.id)?.quantity ?? 0)} onClick={() => quantity(product.id, (cart.find(line => line.id === product.id)?.quantity ?? 0) + 1)} aria-label={`Add ${product.name}`}><Plus size={20} /></button>{!product.service && <button className="icon-button product-inspect" title={"View specs for " + product.name} aria-label={"View specs for " + product.name} onClick={() => setProductDetail(product.item!)}><Eye size={19}/><span className="visually-hidden">View specs</span></button>}</article>)}</div>
      {!filtered.length && <div className="empty-state"><Package size={26} /><h3>No matching products</h3><p>{customerMode ? 'The workshop has not added matching stock yet.' : 'Add inventory to make products available here.'}</p></div>}
    </div><Panel title="Current order" action={<ShoppingCart size={22} />}><div className="order-body">      <div className="cart-lines">{cart.length ? cart.map(line => {
        const item = products.find(item => item.id === line.id)
        return <div className="cart-line" key={line.id}><div><strong>{item?.name ?? 'Unavailable item'}</strong><small>{formatPHP(item?.price ?? 0)} each</small></div><div className="quantity-controls"><button type="button" className="icon-button" aria-label={`Decrease ${item?.name}`} onClick={() => quantity(line.id, line.quantity - 1)}><Minus size={14} /></button><span>{line.quantity}</span><button type="button" className="icon-button" aria-label={`Increase ${item?.name}`} disabled={!item || line.quantity >= item.stock} onClick={() => quantity(line.id, line.quantity + 1)}><Plus size={14} /></button><button type="button" className="icon-button" aria-label={`Remove ${item?.name}`} onClick={() => quantity(line.id, 0)}><Trash2 size={15} /></button></div></div>
    }) : <p className="storage-caption">Add products or services to start an order.</p>}</div>
{cart.length > 0 && <><div className="order-summary"><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span><strong>{formatPHP(totals.total)}</strong></div>{bundleName && <p className="storage-caption">{bundleName}{customerMode ? ' / Store pickup' : ' / Free delivery'}</p>}<button className="primary-button" onClick={() => { setError(''); setCheckoutOpen(true) }}><ArrowRight size={18} />Review checkout</button></>}</div></Panel></div>
    {checkoutOpen && <Dialog title={customerMode ? 'Review your order' : 'Checkout'} wide onClose={() => { if (!busy) setCheckoutOpen(false) }}><div className="checkout-layout"><div className="portal-form settings-fields">
      {!customerMode && <label>Order channel<select aria-label="Order channel" value={channel} onChange={e => setChannel(e.target.value as typeof channel)}><option>Walk-in</option><option>Online</option></select></label>}
      <label>Customer name<input maxLength={100} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Enter customer name" /></label><label>Customer contact<input maxLength={200} value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone or email" /></label>
      <label>Receipt email{!customerMode && ' (optional)'}<input type="email" maxLength={254} value={receiptEmail} onChange={event => setReceiptEmail(event.target.value)} /></label>
      {!customerMode && <details className="charge-details"><summary>Charges, discount & tax</summary><label>Fee or deduction preset<select value="" onChange={e => { const preset = directory.fees.find(item => item.id === e.target.value); if (preset) setCharges({ ...charges, [preset.kind]: preset.value, ...(preset.kind === "other" ? { otherLabel: preset.name } : {}) }) }}><option value="">Apply a directory preset</option>{directory.fees.map(fee => <option key={fee.id} value={fee.id}>{fee.name} / {fee.value}{fee.kind === "taxRate" ? "%" : " PHP"}</option>)}</select></label><div className="portal-form-grid">{(['labor', 'other', 'discount', 'taxRate'] as const).map(field => <label key={field}>{{ labor: 'Labor (PHP)', delivery: 'Delivery (PHP)', other: 'Other charges (PHP)', discount: 'Discount (PHP)', taxRate: 'Tax (%)' }[field]}<input type="number" min="0" step="0.01" max={field === 'taxRate' ? 100 : undefined} value={charges[field]} onChange={e => setCharges({ ...charges, [field]: Number(e.target.value) })} /></label>)}</div><label>Other charge description<input value={charges.otherLabel} maxLength={100} onChange={e => setCharges({ ...charges, otherLabel: e.target.value })} /></label></details>}
      {customerMode ? <p className="fulfillment-note"><strong>Store pickup · Cash at the counter</strong><br />{shop.address || 'Collect your items at the JBC RigWorks store.'}<br />Show your order QR to staff when you arrive.</p> : jobService ? <p className="fulfillment-note">Service jobs are collected at the workshop counter.</p> : <label>Fulfillment<select aria-label="Fulfillment" value={fulfillment} onChange={e => setFulfillment(e.target.value as typeof fulfillment)}><option>Pickup</option><option>Delivery</option></select></label>}
      {!customerMode && fulfillment === 'Delivery' && <><label>Delivery address<textarea value={address} maxLength={400} rows={2} onChange={e => setAddress(e.target.value)} /></label><label>One-way road distance (km)<input type="number" min="0.1" step="0.1" value={distance} onChange={e => setDistance(e.target.value)} /></label><p className="storage-caption">Distance from the workshop, subject to confirmation.</p></>}
      {!customerMode && (bundleId || pcSet) && !bundleName && cart.length > 0 && <p className="fulfillment-note">The bundle is incomplete. Standard delivery charges apply until all bundle items are restored.</p>}
      {bundleName && <p className="fulfillment-note">{bundleName}: {customerMode ? 'collect your complete set at the store.' : 'free delivery guaranteed while the full set remains in your cart.'}</p>}
      {!customerMode && fulfillment === 'Delivery' && deliveryFee === null && <p role="status" className="fulfillment-note">Delivery quote required. Enter a distance and configure transport rates before checkout, or choose pickup.</p>}
      <details className="warranty-details"><summary>Item warranty policy</summary><p className="storage-caption">Item warranty: {shop.warrantyMonths === '' ? 'duration pending workshop confirmation' : shop.warrantyMonths + ' months by default'}. {shop.warrantyTerms || 'Warranty terms will be confirmed by the workshop.'} Each purchased item keeps its own warranty record on the invoice.</p></details>
</div><div className="portal-form settings-fields checkout-review">      <dl className="checkout-totals">{[['Items', totals.subtotal], ['Labor', effectiveCharges.labor], ['Delivery', effectiveCharges.delivery], [effectiveCharges.otherLabel || 'Other charges', effectiveCharges.other], ['Discount', -effectiveCharges.discount], [`Tax (${effectiveCharges.taxRate}%)`, totals.tax], ['Total', totals.total]].map(([label, amount], index) => <div key={index}><dt>{label}</dt><dd>{formatPHP(Number(amount))}</dd></div>)}</dl>
      {!customerMode && <section className="cashier-panel" aria-label="Cashier payment controls">
        <div className="cashier-panel-heading"><span className="service-icon"><Banknote size={21}/></span><span><strong>Cashier</strong><small>Record what the customer hands over</small></span></div>
        <p className="fulfillment-note">Payment method: cash at the store.</p>
          <label>Amount received (PHP)<input inputMode="decimal" type="number" min="0" step="0.01" value={cashReceived} onChange={event => setCashReceived(event.target.value)} placeholder="Enter cash received" /></label>
          <div className="cashier-quick"><span>Quick amount</span>{cashShortcuts(totals.total).map((value, index) => <button type="button" className="secondary-button" key={`${value}-${index}`} onClick={() => setQuickCash(value)}>{index === 0 ? 'Exact' : formatPHP(value)}</button>)}</div>
          <dl className="checkout-totals cashier-totals"><div><dt>Amount applied</dt><dd>{formatPHP(cashPaid)}</dd></div><div><dt>Change to return</dt><dd>{formatPHP(Math.max(0, receivedCash - cashPaid))}</dd></div><div><dt>Balance after payment</dt><dd>{formatPHP(Math.max(0, totals.total - cashPaid))}</dd></div></dl>
      </section>}
      <label>Order notes<textarea rows={2} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <p className="storage-caption">{customerMode ? 'Checkout creates an unpaid order and an order QR. Pay cash when you collect your items. Available company bank or e-wallet QRs and proof uploads appear in your order details. A transaction receipt is issued after staff records or verifies payment.' : 'Completing a sale deducts stock. Recording payment creates a transaction receipt.'}</p>
      <div className="dialog-actions"><button className="primary-button" disabled={busy || !cart.length || (fulfillment === 'Delivery' && deliveryFee === null)} onClick={checkout}>{busy ? <LoaderCircle className="loading-icon" size={18} /> : customerMode ? <ShoppingCart size={18} /> : <Banknote size={18} />}{busy ? 'Saving…' : customerMode ? 'Place order' : 'Complete sale'}</button></div>
    </div></div></Dialog>}
    {bundlesOpen && <Dialog title="Bundles & PC sets" wide onClose={() => setBundlesOpen(false)}><BundleCatalog onSelect={selectBundle} /></Dialog>}
    {productDetail && <ProductDialog item={productDetail} onClose={() => setProductDetail(null)}/>}
    {sale && <InvoiceDialog sale={sale} onClose={() => setSale(null)} />}
    {scannerOpen && <OrderScanner onSelect={openScannedOrder} onClose={() => setScannerOpen(false)} />}
  </>
}
