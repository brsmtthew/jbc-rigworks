import { Banknote, ReceiptText, ScanLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { formatPHP } from '../../lib/format'
import { InvoiceDialog } from '../finance/InvoiceDialog'
import { OrderScanner } from './OrderScanner'
import type { PosController } from './usePos'

export function CollectPayment({
  setShowOrders,
  setCollectingSaleMode,
  scannerOpen,
  setScannerOpen,
  collectingSale,
  needsProcessing,
  proofs,
  pendingProof,
  reviewNote,
  setReviewNote,
  cashReceived,
  setCashReceived,
  setReceiptEmail,
  receiptEmail,
  sale,
  setSale,
  error,
  busy,
  receivedCash,
  collectBalance,
  collectionCashPaid,
  collectOutstanding,
  setQuickCash,
  openScannedOrder,
  prepareOrder,
  rejectProof,
  confirmPickup,
  cashShortcuts,
}: Pick<
  PosController,
  | 'setShowOrders'
  | 'setCollectingSaleMode'
  | 'scannerOpen'
  | 'setScannerOpen'
  | 'collectingSale'
  | 'needsProcessing'
  | 'proofs'
  | 'pendingProof'
  | 'reviewNote'
  | 'setReviewNote'
  | 'cashReceived'
  | 'setCashReceived'
  | 'setReceiptEmail'
  | 'receiptEmail'
  | 'sale'
  | 'setSale'
  | 'error'
  | 'busy'
  | 'receivedCash'
  | 'collectBalance'
  | 'collectionCashPaid'
  | 'collectOutstanding'
  | 'setQuickCash'
  | 'openScannedOrder'
  | 'prepareOrder'
  | 'rejectProof'
  | 'confirmPickup'
  | 'cashShortcuts'
>) {
  return (
    <>
      <PageHeader
        eyebrow="CASHIER"
        title="Collect payment"
        description="Record cash received at the store or verify a submitted transfer."
      >
        <button className="secondary-button" onClick={() => setScannerOpen(true)}>
          <ScanLine size={18} />
          Scan order QR
        </button>
        <Link
          className="secondary-button"
          to="/pos"
          onClick={() => {
            setCollectingSaleMode(null)
            setShowOrders(false)
          }}
        >
          Back to POS
        </Link>
      </PageHeader>
      {collectingSale ? (
        <div className="cashier-screen">
          <Panel title={`Invoice ${collectingSale.id}`} subtitle={collectingSale.customer}>
            <div className="cashier-invoice-summary">
              <span>
                Invoice total<strong>{formatPHP(collectingSale.total)}</strong>
              </span>
              <span>
                Paid so far<strong>{formatPHP(collectingSale.paid)}</strong>
              </span>
              <span>
                Balance due<strong>{formatPHP(collectBalance)}</strong>
              </span>
            </div>
            <div className="cashier-sale-lines">
              {collectingSale.lines?.length ? (
                collectingSale.lines.map((line) => (
                  <div key={line.id}>
                    <span>
                      {line.quantity} × {line.description}
                    </span>
                    <strong>{formatPHP(line.quantity * line.unitPrice)}</strong>
                  </div>
                ))
              ) : (
                <p>{collectingSale.detail}</p>
              )}
            </div>
          </Panel>
          <Panel
            title="Payment"
            subtitle="Enter the amount received and return the correct change."
          >
            <div className="cashier-form portal-form settings-fields">
              <label>
                Receipt email
                <input
                  type="email"
                  maxLength={254}
                  value={receiptEmail}
                  onChange={(event) => setReceiptEmail(event.target.value)}
                />
              </label>
              {needsProcessing && (
                <>
                  <p>Review and prepare this order before recording payment.</p>
                  <button className="primary-button" disabled={busy} onClick={prepareOrder}>
                    Prepare order in POS
                  </button>
                </>
              )}
              {pendingProof ? (
                <section className="payment-proof-panel portal-form">
                  <h3>Transfer proof awaiting verification</h3>
                  <p>
                    {pendingProof.method} / {formatPHP(pendingProof.amount)} / Reference{' '}
                    {pendingProof.reference}
                  </p>
                  <img
                    className="payment-proof-image"
                    src={pendingProof.image}
                    alt="Customer payment proof"
                  />
                  <p>
                    Check the amount and reference in the company bank or e-wallet account before
                    recording this payment.
                  </p>
                  <button
                    className="primary-button"
                    disabled={busy || needsProcessing || proofs.loading}
                    onClick={() => collectOutstanding(true)}
                  >
                    Verify transfer and issue receipt
                  </button>
                  <label>
                    Reason for rejecting proof
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                    />
                  </label>
                  <button className="secondary-button" disabled={busy} onClick={rejectProof}>
                    Reject proof
                  </button>
                </section>
              ) : (
                <>
                  <p className="fulfillment-note">Payment method: cash received at the store.</p>
                  <label>
                    Cash received (PHP)
                    <input
                      autoFocus
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashReceived}
                      onChange={(event) => setCashReceived(event.target.value)}
                    />
                  </label>
                  <div className="cashier-quick">
                    <span>Quick cash</span>
                    {cashShortcuts(collectBalance).map((value, index) => (
                      <button
                        type="button"
                        className="secondary-button"
                        key={`${value}-${index}`}
                        onClick={() => setQuickCash(value)}
                      >
                        {index === 0 ? 'Exact' : formatPHP(value)}
                      </button>
                    ))}
                  </div>
                  <dl className="checkout-totals cashier-totals">
                    <div>
                      <dt>Applying now</dt>
                      <dd>{formatPHP(collectionCashPaid)}</dd>
                    </div>
                    <div>
                      <dt>Change to return</dt>
                      <dd>{formatPHP(Math.max(0, receivedCash - collectionCashPaid))}</dd>
                    </div>
                    <div>
                      <dt>Balance after payment</dt>
                      <dd>{formatPHP(Math.max(0, collectBalance - collectionCashPaid))}</dd>
                    </div>
                  </dl>
                  <button
                    className="primary-button cashier-submit"
                    disabled={
                      busy ||
                      needsProcessing ||
                      proofs.loading ||
                      !!proofs.error ||
                      collectBalance <= 0
                    }
                    onClick={() => collectOutstanding()}
                  >
                    <Banknote size={18} />
                    {busy ? 'Saving…' : 'Record payment'}
                  </button>
                </>
              )}
              {(error || proofs.error) && (
                <p role="alert" className="form-error">
                  {error || proofs.error}
                </p>
              )}
              {collectBalance <= 0 && (
                <p className="save-message">
                  This order is already paid. No further payment is needed.
                </p>
              )}
              {!collectingSale.buildId &&
                !collectingSale.serviceJobId &&
                collectingSale.customerId &&
                collectBalance <= 0 &&
                !needsProcessing &&
                (collectingSale.orderStatus === 'Completed' ? (
                  <p className="save-message">Pickup completed.</p>
                ) : (
                  <button
                    className="primary-button"
                    disabled={
                      busy ||
                      !['Ready', 'Out for delivery'].includes(collectingSale.orderStatus ?? '')
                    }
                    onClick={confirmPickup}
                  >
                    Confirm pickup
                  </button>
                ))}
              {collectingSale.buildId && (
                <Link className="secondary-button" to="/pc-building">
                  Return to PC Builds
                </Link>
              )}
              <button className="secondary-button" onClick={() => setSale(collectingSale)}>
                View order QR / receipt
              </button>
            </div>
          </Panel>
        </div>
      ) : (
        <div className="empty-state">
          <ReceiptText size={28} />
          <h3>Invoice unavailable</h3>
          <p>Return to Sales and open the invoice again.</p>
          <Link className="secondary-button" to="/sales">
            Back to sales
          </Link>
        </div>
      )}
      {sale && <InvoiceDialog sale={sale} onClose={() => setSale(null)} />}
      {scannerOpen && (
        <OrderScanner onSelect={openScannedOrder} onClose={() => setScannerOpen(false)} />
      )}
    </>
  )
}
