import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { formatPHP } from '../../data/appData'
import { formatDate } from '../../lib/business'
import { useShopSettings } from '../../lib/preferences'
import type { Sale, Seller, InvoiceLine } from '../../types/business'
import { BrandLogo } from '../../components/ui/BrandLogo'

function Invoice({ sale, seller }: { sale: Sale; seller: Seller }) {
  const lines: InvoiceLine[] = sale.lines ?? [{ id: sale.id, description: sale.detail, quantity: 1, unitPrice: sale.total, unitCost: sale.cost }]
  const charges = sale.charges ?? { subtotal: sale.total, labor: 0, delivery: 0, other: 0, otherLabel: 'Other charges', discount: 0, taxRate: 0, tax: 0 }
  return <article className="invoice-document">
    <div className="invoice-brand"><div className="invoice-logo"><BrandLogo /></div><div><h2>INVOICE</h2><strong>{sale.id}</strong><p>{formatDate(sale.date)}</p></div></div>
    <div className="invoice-parties"><div><h3>{seller.name}</h3><p>{seller.address}</p><p>{seller.phone}</p><p>{seller.email}</p></div><div><span>Bill to</span><h3>{sale.customer}</h3><p>{sale.contact}</p><p>{sale.channel ?? 'Walk-in'} · {sale.paymentMethod ?? 'Not specified'}</p></div></div>
    <table className="invoice-table"><thead><tr><th>Item / service</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{lines.map(line => <tr key={line.id}><td>{line.description}{line.inventoryId && <small className="invoice-warranty">Warranty: {line.warranty?.months == null ? 'Duration pending confirmation' : line.warranty.months + ' months'}{line.warranty?.expires ? ' | ' + line.warranty.starts + ' to ' + line.warranty.expires : ''}<br />{line.warranty?.terms || 'Terms pending workshop confirmation.'}</small>}</td><td>{line.quantity}</td><td>{formatPHP(line.unitPrice)}</td><td>{formatPHP(line.quantity * line.unitPrice)}</td></tr>)}</tbody></table>
    <dl className="invoice-totals">
      {[['Items subtotal', charges.subtotal], ['Labor / assembly', charges.labor], ['Delivery', charges.delivery], [charges.otherLabel || 'Other charges', charges.other], ['Discount', -charges.discount], [`Tax (${charges.taxRate}%)`, charges.tax], ['Grand total', sale.total], ['Payment received', sale.paid], ['Balance due', Math.max(0, sale.total - sale.paid)]].map(([label, value], index) => <div key={index} className={index === 6 || index === 8 ? 'invoice-total' : ''}><dt>{label}</dt><dd>{formatPHP(Number(value))}</dd></div>)}
    </dl>
    {sale.cashTendered !== undefined && <p className="invoice-notes">Cash tendered: {formatPHP(sale.cashTendered)} / Change returned: {formatPHP(sale.change || 0)}</p>}
    {sale.fulfillment && <p className="invoice-notes">{sale.fulfillment.mode}{sale.fulfillment.mode === 'Delivery' && <>: {sale.fulfillment.address} ({sale.fulfillment.distanceKm} km)<br />{sale.fulfillment.freeDelivery ? 'Free delivery guaranteed: ' + sale.fulfillment.bundleName : formatPHP(sale.fulfillment.baseFee) + ' base + ' + formatPHP(sale.fulfillment.perKm) + ' per km'}</>}</p>}
    {sale.notes && <p className="invoice-notes">Notes: {sale.notes}</p>}
    <footer><p>{seller.footer}</p><small>Payment status: {sale.status}</small></footer>
  </article>
}
export function InvoiceDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const [shop] = useShopSettings()
  const seller = sale.seller ?? shop
  return <>
    <Dialog title={`Invoice ${sale.id}`} onClose={onClose}><div className="invoice-actions"><button className="primary-button" onClick={() => window.print()} title="Print invoice" aria-label="Print invoice"><Printer size={20} /></button><span className="storage-caption">Choose a printer or Save as PDF.</span></div><Invoice sale={sale} seller={seller} /></Dialog>
    {createPortal(<div className="invoice-print-root"><Invoice sale={sale} seller={seller} /></div>, document.body)}
  </>
}
