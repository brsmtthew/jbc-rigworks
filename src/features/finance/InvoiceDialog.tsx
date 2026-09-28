import { Printer } from 'lucide-react'
import { createPortal } from 'react-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { Dialog } from '../../components/ui/Dialog'
import { LoadingState } from '../../components/ui/LoadingState'
import { useLiveDocument } from '../../hooks/useLiveData'
import { useAuth } from '../../lib/auth-context'
import { formatDate, formatPHP } from '../../lib/format'
import { useShopSettings } from '../../lib/preferences'
import type { InvoiceLine, Sale, Seller, TransactionReceipt } from '../../types'
import { PaymentProofPanel } from '../customer/PaymentProofPanel'
import { OrderQr } from '../pos/OrderQr'

function Invoice({
  sale,
  seller,
  receipt,
}: {
  sale: Sale
  seller: Seller
  receipt?: TransactionReceipt
}) {
  const lines: InvoiceLine[] = sale.lines ?? [
    {
      id: sale.id,
      description: sale.detail,
      quantity: 1,
      unitPrice: sale.total,
      unitCost: sale.cost,
    },
  ]
  const charges = sale.charges ?? {
    subtotal: sale.total,
    labor: 0,
    delivery: 0,
    other: 0,
    otherLabel: 'Other charges',
    discount: 0,
    taxRate: 0,
    tax: 0,
  }
  return (
    <article className="invoice-document">
      <div className="invoice-brand">
        <div className="invoice-logo">
          <BrandLogo />
        </div>
        <div>
          <h2>
            {receipt
              ? 'TRANSACTION RECEIPT'
              : sale.customerId && sale.status !== 'Paid'
                ? 'ORDER SLIP'
                : 'INVOICE'}
          </h2>
          <strong>{receipt?.id || sale.id}</strong>
          <p>
            {receipt
              ? new Date(receipt.issuedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
              : formatDate(sale.date)}
          </p>
        </div>
      </div>
      <div className="invoice-parties">
        <div>
          <h3>{seller.name}</h3>
          <p>{seller.address}</p>
          <p>{seller.phone}</p>
          <p>{seller.email}</p>
        </div>
        <div>
          <span>Bill to</span>
          <h3>{sale.customer}</h3>
          <p>{sale.contact}</p>
          <p>
            {sale.channel ?? 'Walk-in'} · {sale.paymentMethod ?? 'Not specified'}
          </p>
        </div>
      </div>
      <table className="invoice-table">
        <thead>
          <tr>
            <th>Item / service</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                {line.description}
                {line.inventoryId && (
                  <small className="invoice-warranty">
                    Warranty:{' '}
                    {line.warranty?.months == null
                      ? 'Duration pending confirmation'
                      : line.warranty.months === 0
                        ? 'No coverage'
                        : line.warranty.months +
                          (line.warranty.months === 1 ? ' month' : ' months')}
                    {line.warranty?.expires
                      ? ' | ' + line.warranty.starts + ' to ' + line.warranty.expires
                      : ''}
                    <br />
                    {line.warranty?.terms || 'Terms pending workshop confirmation.'}
                  </small>
                )}
              </td>
              <td>{line.quantity}</td>
              <td>{formatPHP(line.unitPrice)}</td>
              <td>{formatPHP(line.quantity * line.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="invoice-totals">
        {[
          ['Items subtotal', charges.subtotal],
          ['Labor / assembly', charges.labor],
          ['Delivery', charges.delivery],
          [charges.otherLabel || 'Other charges', charges.other],
          ['Discount', -charges.discount],
          [`Tax (${charges.taxRate}%)`, charges.tax],
          ['Grand total', sale.total],
          ['Payment received', sale.paid],
          ['Balance due', Math.max(0, sale.total - sale.paid)],
        ]
          .filter(
            ([label, value]) =>
              ['Items subtotal', 'Grand total', 'Payment received'].includes(String(label)) ||
              Number(value) !== 0,
          )
          .map(([label, value], index) => (
            <div key={index} className={label === 'Grand total' ? 'invoice-total' : ''}>
              <dt>{label}</dt>
              <dd>{formatPHP(Number(value))}</dd>
            </div>
          ))}
      </dl>
      {receipt && (
        <section className="receipt-payment">
          <h3>Payment recorded</h3>
          <p>
            {formatPHP(receipt.payment.amount)} / {receipt.payment.method}
          </p>
          {receipt.payment.reference && <p>Transfer reference: {receipt.payment.reference}</p>}
        </section>
      )}
      {sale.paid === 0 && (
        <p className="invoice-notes">
          <strong>Payment pending.</strong> Show the order QR at the store to pay and collect your
          items. Any submitted transfer proof requires staff verification.
        </p>
      )}
      {sale.paid >= sale.total ? (
        <p className="save-message">
          <strong>PAID</strong> / Keep this receipt for transaction and warranty reference.
        </p>
      ) : (
        <OrderQr orderId={sale.id} />
      )}
      {sale.cashTendered !== undefined && (
        <p className="invoice-notes">
          Cash tendered: {formatPHP(sale.cashTendered)} / Change returned:{' '}
          {formatPHP(sale.change || 0)}
        </p>
      )}
      {sale.fulfillment && (
        <p className="invoice-notes">
          {sale.fulfillment.mode}
          {sale.fulfillment.mode === 'Delivery' && (
            <>
              : {sale.fulfillment.address}
              <br />
              {sale.fulfillment.freeDelivery
                ? 'Free delivery: ' + sale.fulfillment.bundleName
                : 'Delivery fee: ' + formatPHP(charges.delivery)}
            </>
          )}
        </p>
      )}
      {sale.notes && <p className="invoice-notes">Notes: {sale.notes}</p>}
      <footer>
        <p>{seller.footer}</p>
        <small>Payment status: {sale.status}</small>
      </footer>
    </article>
  )
}
export function InvoiceDialog({ sale: initialSale, onClose }: { sale: Sale; onClose: () => void }) {
  const { user } = useAuth()
  const [shop] = useShopSettings()
  const liveSale = useLiveDocument<Sale>(
    initialSale.customerId ? 'orders' : 'sales',
    initialSale.id,
  )
  const sale = liveSale.value || initialSale
  const receipt = useLiveDocument<TransactionReceipt>('receipts', sale.lastReceiptId)
  const documentSale = receipt.value?.sale || sale
  const seller = documentSale.seller ?? shop
  const title = `${receipt.value ? 'Receipt' : sale.customerId && sale.status !== 'Paid' ? 'Order slip' : 'Invoice'} ${sale.id}`
  return (
    <>
      <Dialog title={title} onClose={onClose}>
        <div className="invoice-actions">
          <button className="primary-button" onClick={() => window.print()}>
            <Printer size={18} />
            {receipt.value ? 'Print receipt' : 'Print order details'}
          </button>
          <span className="storage-caption">Choose a printer or Save as PDF.</span>
        </div>
        {(liveSale.error || receipt.error) && (
          <p role="alert" className="form-error">
            {liveSale.error || receipt.error}
          </p>
        )}
        {receipt.loading && <LoadingState variant="compact" label="Loading receipt…" />}
        <Invoice sale={documentSale} seller={seller} receipt={receipt.value} />
        {receipt.value?.recipientEmail && (
          <p className="storage-caption">
            Receipt email prepared for {receipt.value.recipientEmail}. Email delivery is not
            available yet; you can print or save your receipt here.
          </p>
        )}
        {user?.role === 'user' && <PaymentProofPanel order={sale} />}
      </Dialog>
      {createPortal(
        <div className="invoice-print-root">
          <Invoice sale={documentSale} seller={seller} receipt={receipt.value} />
        </div>,
        document.body,
      )}
    </>
  )
}
