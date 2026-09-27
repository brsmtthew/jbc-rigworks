import { Banknote, LoaderCircle, ShoppingCart } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { formatPHP } from '../../lib/format'
import { accountAvailable } from '../finance/payments'
import type { PosController } from './usePos'

export function CheckoutDialog({
  directory,
  customerMode,
  accounts,
  paymentAccountId,
  setPaymentAccountId,
  paymentReference,
  setPaymentReference,
  paymentVerified,
  setPaymentVerified,
  paymentAccount,
  shop,
  cashReceived,
  setCashReceived,
  jobService,
  cart,
  bundleId,
  pcSet,
  fulfillment,
  setFulfillment,
  setAddress,
  address,
  bundleName,
  selectedBundle,
  hasProducts,
  deliveryFee,
  setCustomer,
  customer,
  setContact,
  contact,
  notes,
  setNotes,
  setReceiptEmail,
  receiptEmail,
  setCharges,
  charges,
  error,
  busy,
  setCheckoutOpen,
  effectiveCharges,
  totals,
  receivedCash,
  cashPaid,
  checkout,
  setQuickCash,
  cashShortcuts,
}: Pick<
  PosController,
  | 'directory'
  | 'customerMode'
  | 'accounts'
  | 'paymentAccountId'
  | 'setPaymentAccountId'
  | 'paymentReference'
  | 'setPaymentReference'
  | 'paymentVerified'
  | 'setPaymentVerified'
  | 'paymentAccount'
  | 'shop'
  | 'cashReceived'
  | 'setCashReceived'
  | 'jobService'
  | 'cart'
  | 'bundleId'
  | 'pcSet'
  | 'fulfillment'
  | 'setFulfillment'
  | 'setAddress'
  | 'address'
  | 'bundleName'
  | 'selectedBundle'
  | 'hasProducts'
  | 'deliveryFee'
  | 'setCustomer'
  | 'customer'
  | 'setContact'
  | 'contact'
  | 'notes'
  | 'setNotes'
  | 'setReceiptEmail'
  | 'receiptEmail'
  | 'setCharges'
  | 'charges'
  | 'error'
  | 'busy'
  | 'setCheckoutOpen'
  | 'effectiveCharges'
  | 'totals'
  | 'receivedCash'
  | 'cashPaid'
  | 'checkout'
  | 'setQuickCash'
  | 'cashShortcuts'
>) {
  return (
    <Dialog
      title={customerMode ? 'Review your order' : 'Checkout'}
      wide
      onClose={() => {
        if (!busy) setCheckoutOpen(false)
      }}
      footer={
        <>
          <span>Total {formatPHP(totals.total)}</span>
          <button
            className="primary-button"
            disabled={
              busy ||
              !cart.length ||
              (!customerMode &&
                (paymentAccount
                  ? !paymentVerified || !paymentReference.trim()
                  : cashPaid !== totals.total))
            }
            onClick={checkout}
          >
            {busy ? (
              <LoaderCircle className="loading-icon" size={18} />
            ) : customerMode ? (
              <ShoppingCart size={18} />
            ) : (
              <Banknote size={18} />
            )}
            {busy ? 'Saving…' : customerMode ? 'Place order' : 'Complete sale'}
          </button>
        </>
      }
    >
      <div className="checkout-layout">
        <div className="portal-form settings-fields">
          <label>
            Customer name
            <input
              maxLength={100}
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Enter customer name"
            />
          </label>
          <label>
            Customer contact
            <input
              maxLength={200}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email"
            />
          </label>
          <label>
            Receipt email{!customerMode && ' (optional)'}
            <input
              type="email"
              maxLength={254}
              value={receiptEmail}
              onChange={(event) => setReceiptEmail(event.target.value)}
            />
          </label>
          {!customerMode && (
            <details className="charge-details">
              <summary>Charges, discount & tax</summary>
              <label>
                Fee or deduction preset
                <select
                  value=""
                  onChange={(e) => {
                    const preset = directory.fees.find((item) => item.id === e.target.value)
                    if (preset)
                      setCharges({
                        ...charges,
                        [preset.kind]: preset.value,
                        ...(preset.kind === 'other' ? { otherLabel: preset.name } : {}),
                      })
                  }}
                >
                  <option value="">Apply a directory preset</option>
                  {directory.fees.map((fee) => (
                    <option key={fee.id} value={fee.id}>
                      {fee.name} / {fee.value}
                      {fee.kind === 'taxRate' ? '%' : ' PHP'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="portal-form-grid">
                {(['labor', 'other', 'discount', 'taxRate'] as const).map((field) => (
                  <label key={field}>
                    {
                      {
                        labor: 'Labor (PHP)',
                        delivery: 'Delivery (PHP)',
                        other: 'Other charges (PHP)',
                        discount: 'Discount (PHP)',
                        taxRate: 'Tax (%)',
                      }[field]
                    }
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={field === 'taxRate' ? 100 : undefined}
                      value={charges[field]}
                      onChange={(e) => setCharges({ ...charges, [field]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
              <label>
                Other charge description
                <input
                  value={charges.otherLabel}
                  maxLength={100}
                  onChange={(e) => setCharges({ ...charges, otherLabel: e.target.value })}
                />
              </label>
            </details>
          )}
          {!hasProducts ? (
            <p className="fulfillment-note">
              {jobService
                ? 'Payment for the approved service job. Device release is completed in Services.'
                : 'Workshop service payment. Product delivery does not apply.'}
            </p>
          ) : (
            <label>
              Fulfillment
              <select
                value={fulfillment}
                onChange={(e) => setFulfillment(e.target.value as typeof fulfillment)}
              >
                <option>Pickup</option>
                <option>Delivery</option>
              </select>
            </label>
          )}
          {hasProducts && fulfillment === 'Delivery' && (
            <>
              <label>
                Delivery address
                <textarea
                  value={address}
                  required
                  maxLength={400}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <p>Delivery fee: {formatPHP(deliveryFee)}. JBC confirms the delivery schedule.</p>
            </>
          )}
          <label>
            Payment method
            <select
              value={paymentAccountId}
              onChange={(e) => {
                setPaymentAccountId(e.target.value)
                setPaymentVerified(false)
              }}
            >
              <option value="">{customerMode ? 'Pay at workshop' : 'Cash'}</option>
              {accounts.rows
                .filter(
                  (account) =>
                    accountAvailable(account) &&
                    (customerMode ? account.customers !== false : account.pos !== false),
                )
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} / {account.kind}
                  </option>
                ))}
            </select>
          </label>
          {paymentAccount && (
            <section className="payment-proof-panel">
              <h3>{paymentAccount.name}</h3>
              <p>
                {paymentAccount.accountName} / {paymentAccount.accountNumber}
              </p>
              <img
                className="payment-qr-image"
                src={paymentAccount.qrImage}
                alt="Company payment QR"
              />
              <p>{paymentAccount.instructions}</p>
              {customerMode ? (
                <p>
                  Submit your payment reference and proof from order details after placing your
                  order. Payment remains pending until JBC verifies receipt.
                </p>
              ) : (
                <>
                  <label>
                    Transfer reference
                    <input
                      required
                      maxLength={100}
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                    />
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={paymentVerified}
                      onChange={(e) => setPaymentVerified(e.target.checked)}
                    />
                    I verified the full payment in the company account
                  </label>
                </>
              )}
            </section>
          )}

          {!customerMode && (bundleId || pcSet) && !bundleName && cart.length > 0 && (
            <p className="fulfillment-note">
              The bundle is incomplete. Standard delivery charges apply until all bundle items are
              restored.
            </p>
          )}
          {bundleName && (
            <p className="fulfillment-note">
              {bundleName}:{' '}
              {selectedBundle?.freeDelivery
                ? 'free delivery while the full set remains in your cart.'
                : 'delivery charged at checkout.'}
            </p>
          )}
          {!customerMode && fulfillment === 'Delivery' && deliveryFee === null && (
            <p role="status" className="fulfillment-note">
              Delivery quote required. Enter a distance and configure transport rates before
              checkout, or choose pickup.
            </p>
          )}
          {hasProducts && (
            <details className="warranty-details">
              <summary>Item warranty policy</summary>
              <p className="storage-caption">
                Item warranty:{' '}
                {shop.warrantyMonths === ''
                  ? 'duration pending workshop confirmation'
                  : shop.warrantyMonths + ' months by default'}
                . {shop.warrantyTerms || 'Warranty terms will be confirmed by the workshop.'} Each
                purchased item keeps its own warranty record on the invoice.
              </p>
            </details>
          )}
        </div>
        <div className="portal-form settings-fields checkout-review">
          {' '}
          <dl className="checkout-totals">
            {[
              ['Items', totals.subtotal],
              ['Labor', effectiveCharges.labor],
              ['Delivery', effectiveCharges.delivery],
              [effectiveCharges.otherLabel || 'Other charges', effectiveCharges.other],
              ['Discount', -effectiveCharges.discount],
              [`Tax (${effectiveCharges.taxRate}%)`, totals.tax],
              ['Total', totals.total],
            ]
              .filter(
                ([label, amount]) => label === 'Items' || label === 'Total' || Number(amount) !== 0,
              )
              .map(([label, amount], index) => (
                <div key={index}>
                  <dt>{label}</dt>
                  <dd>{formatPHP(Number(amount))}</dd>
                </div>
              ))}
          </dl>
          {!customerMode && !paymentAccount && (
            <section className="cashier-panel" aria-label="Cashier payment controls">
              <div className="cashier-panel-heading">
                <span className="service-icon">
                  <Banknote size={21} />
                </span>
                <span>
                  <strong>Cashier</strong>
                  <small>Record what the customer hands over</small>
                </span>
              </div>
              <p className="fulfillment-note">Payment method: cash at the store.</p>
              <label>
                Amount received (PHP)
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  placeholder="Enter cash received"
                />
              </label>
              <div className="cashier-quick">
                <span>Quick amount</span>
                {cashShortcuts(totals.total).map((value, index) => (
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
                  <dt>Amount applied</dt>
                  <dd>{formatPHP(cashPaid)}</dd>
                </div>
                <div>
                  <dt>Change to return</dt>
                  <dd>{formatPHP(Math.max(0, receivedCash - cashPaid))}</dd>
                </div>
                <div>
                  <dt>Balance after payment</dt>
                  <dd>{formatPHP(Math.max(0, totals.total - cashPaid))}</dd>
                </div>
              </dl>
            </section>
          )}
          <label>
            Order notes
            <textarea
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <p className="storage-caption">
            {customerMode
              ? 'Your order remains unpaid until JBC receives payment. Pay at the workshop or submit a transfer proof from order details. Pickup or delivery is arranged after JBC confirms your order.'
              : 'Completing a sale deducts stock. Recording payment creates a transaction receipt.'}
          </p>
        </div>
      </div>
    </Dialog>
  )
}
