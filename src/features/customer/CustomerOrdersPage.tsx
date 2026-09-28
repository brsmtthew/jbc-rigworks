import { RecordStatus } from './RecordStatus'
import { LoadingState } from '../../components/ui/LoadingState'
import { Eye, Pencil, Printer, ShoppingCart, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useWorkspace } from '../../hooks/useWorkspace'
import { formatDate, formatPHP } from '../../lib/format'
import type { Sale } from '../../types'
import { InvoiceDialog } from '../finance/InvoiceDialog'
import { Dialog } from '../../components/ui/Dialog'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import { changePendingOrder, type PendingOrderEdits } from './customerOrderOperations'

export function CustomerOrdersPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const { busy, error, run, setError } = useAsyncAction()
  const { sales, loading, storageError } = useWorkspace()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const filtered = sales
    .filter(
      (sale) =>
        (status === 'All' || (sale.orderStatus || 'Requested') === status) &&
        `${sale.id} ${sale.detail}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
  const [invoice, setInvoice] = useState<{ sale: Sale; autoPrint: boolean } | null>(null)
  const [editing, setEditing] = useState<Sale | null>(null)
  const [draft, setDraft] = useState<PendingOrderEdits | null>(null)
  function edit(sale: Sale) {
    setEditing(sale)
    setDraft({
      customer: sale.customer,
      contact: sale.contact ?? '',
      receiptEmail: sale.receiptEmail ?? '',
      notes: sale.notes ?? '',
      address: sale.fulfillment?.address ?? '',
    })
    setError('')
  }
  async function saveEdits() {
    if (!user || !editing || !draft) return
    await run(async () => {
      if (
        !(await confirm({
          title: 'Save order changes?',
          message: `Update the contact and delivery details for ${editing.id}?`,
          confirmLabel: 'Save changes',
        }))
      )
        return
      await changePendingOrder(user, editing.id, draft)
      setEditing(null)
    })
  }
  async function cancelOrder(sale: Sale) {
    if (!user) return
    await run(async () => {
      if (
        !(await confirm({
          title: 'Cancel order?',
          message: `Cancel ${sale.id}? The order will remain in your history.`,
          confirmLabel: 'Cancel order',
          tone: 'danger',
        }))
      )
        return
      await changePendingOrder(user, sale.id, null)
      if (editing?.id === sale.id) setEditing(null)
    })
  }
  return (
    <>
      {!embedded && (
        <PageHeader
          eyebrow="MY ACCOUNT"
          title="My orders"
          description="Review your orders and view your order QR and transaction receipt."
        >
          <Link className="primary-button" to="/customer/shop">
            <ShoppingCart size={16} />
            Shop & order
          </Link>
        </PageHeader>
      )}
      <div className="record-filters">
        <label>
          Search purchases
          <input
            type="search"
            value={query}
            placeholder="Product or reference"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Order status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All</option>
            {[...new Set(sales.map((sale) => sale.orderStatus || 'Requested'))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="storage-caption">
        {!loading &&
          !storageError &&
          'Payments received by JBC: ' + formatPHP(sales.reduce((sum, sale) => sum + sale.paid, 0))}
      </p>
      {error && !editing && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Panel title="Order history">
        {loading ? (
          <LoadingState label="Loading purchases…" />
        ) : storageError ? (
          <p className="form-error" role="alert">
            {storageError}
          </p>
        ) : !sales.length ? (
          <div className="customer-empty">
            <ShoppingCart />
            <p>Your purchases, receipts, and warranties will appear here.</p>
            <Link to="/customer/shop">Browse parts</Link>
          </div>
        ) : (
          <div className="customer-order-list">
            <p className="customer-records-sort-note">Newest orders first</p>
            {!filtered.length && (
              <p className="customer-empty">No orders match your search or status filter.</p>
            )}
            {filtered.map((sale) => (
              <article className="customer-order-card" key={sale.id}>
                <div className="customer-order-card-main">
                  <span className="customer-order-card-icon">
                    <ShoppingCart size={20} />
                  </span>
                  <div>
                    <h3>{sale.detail}</h3>
                    <span className="customer-record-subtitle">
                      Order placed {formatDate(sale.date)}
                    </span>
                  </div>
                </div>
                <dl className="customer-record-values customer-order-meta">
                  <div>
                    <dt>Order status</dt>
                    <dd>
                      <RecordStatus status={sale.orderStatus || 'Requested'} />
                    </dd>
                  </div>
                  <div>
                    <dt>Payment</dt>
                    <dd>
                      <RecordStatus status={sale.paymentStatus ?? sale.status} />
                    </dd>
                  </div>
                  <div className="customer-record-value-total">
                    <dt>Total</dt>
                    <dd>{formatPHP(sale.total)}</dd>
                  </div>
                  <div className="customer-record-value-reference">
                    <dt>Reference</dt>
                    <dd className="record-reference">{sale.id}</dd>
                  </div>
                </dl>
                <div
                  className="customer-record-actions"
                  role="group"
                  aria-label={`Actions for order ${sale.id}`}
                >
                  <span className="customer-record-actions-label">Actions</span>
                  <button
                    type="button"
                    className="customer-record-action is-primary"
                    aria-label={`View order ${sale.id}`}
                    onClick={() => setInvoice({ sale, autoPrint: false })}
                  >
                    <Eye size={16} /> View
                  </button>
                  <button
                    type="button"
                    className="customer-record-action"
                    aria-label={`Edit order ${sale.id}`}
                    disabled={busy || (sale.orderStatus ?? 'Requested') !== 'Requested'}
                    title={
                      (sale.orderStatus ?? 'Requested') === 'Requested'
                        ? undefined
                        : 'Locked after workshop confirmation'
                    }
                    onClick={() => edit(sale)}
                  >
                    <Pencil size={16} /> Edit
                  </button>
                  <button
                    type="button"
                    className="customer-record-action is-danger"
                    aria-label={`Cancel order ${sale.id}`}
                    disabled={busy || (sale.orderStatus ?? 'Requested') !== 'Requested'}
                    title={
                      (sale.orderStatus ?? 'Requested') === 'Requested'
                        ? undefined
                        : 'Locked after workshop confirmation'
                    }
                    onClick={() => void cancelOrder(sale)}
                  >
                    <Trash2 size={16} /> Cancel
                  </button>
                  <button
                    type="button"
                    className="customer-record-action"
                    aria-label={`Print order ${sale.id}`}
                    onClick={() => setInvoice({ sale, autoPrint: true })}
                  >
                    <Printer size={16} /> Print
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
      {invoice && (
        <InvoiceDialog
          sale={invoice.sale}
          autoPrint={invoice.autoPrint}
          onClose={() => setInvoice(null)}
        />
      )}
      {editing && draft && (
        <Dialog
          title="Edit order details"
          onClose={() => !busy && setEditing(null)}
          footer={
            <>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Discard
              </button>
              <button
                type="submit"
                form="customer-order-edit"
                className="primary-button"
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </>
          }
        >
          <form
            id="customer-order-edit"
            className="portal-form settings-fields"
            onSubmit={(event) => {
              event.preventDefault()
              void saveEdits()
            }}
          >
            <p className="storage-caption">
              Items and prices stay on this order. To change items, cancel the request and place a
              new order before workshop confirmation.
            </p>
            <div className="customer-order-edit-summary">
              <strong>{editing.detail}</strong>
              <span>{formatPHP(editing.total)}</span>
            </div>
            <label>
              Customer name
              <input
                required
                maxLength={120}
                value={draft.customer}
                onChange={(event) => setDraft({ ...draft, customer: event.target.value })}
              />
            </label>
            <label>
              Contact number
              <input
                maxLength={100}
                value={draft.contact}
                required={editing.fulfillment?.mode === 'Delivery'}
                onChange={(event) => setDraft({ ...draft, contact: event.target.value })}
              />
            </label>
            <label>
              Receipt email
              <input
                type="email"
                required
                maxLength={254}
                value={draft.receiptEmail}
                onChange={(event) => setDraft({ ...draft, receiptEmail: event.target.value })}
              />
            </label>
            {editing.fulfillment?.mode === 'Delivery' && (
              <label>
                Delivery address
                <textarea
                  required
                  maxLength={400}
                  rows={3}
                  value={draft.address}
                  onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                />
              </label>
            )}
            <label>
              Order notes
              <textarea
                maxLength={1000}
                rows={3}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  )
}
