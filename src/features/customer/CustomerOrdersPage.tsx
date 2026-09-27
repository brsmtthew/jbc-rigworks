import { RecordStatus } from './RecordStatus'
import { LoadingState } from '../../components/ui/LoadingState'
import { Printer, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DataTable } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useWorkspace } from '../../hooks/useWorkspace'
import { formatPHP } from '../../lib/format'
import type { Sale } from '../../types'
import { InvoiceDialog } from '../finance/InvoiceDialog'

export function CustomerOrdersPage({ embedded = false }: { embedded?: boolean }) {
  const { sales, loading, storageError } = useWorkspace()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const filtered = sales.filter(
    (sale) =>
      (status === 'All' || (sale.orderStatus || 'Requested') === status) &&
      `${sale.id} ${sale.detail}`.toLowerCase().includes(query.toLowerCase()),
  )
  const [invoice, setInvoice] = useState<Sale | null>(null)
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
      <Panel title="Order history">
        {loading ? (
          <LoadingState label="Loading purchases?" />
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
          <DataTable
            rows={filtered}
            label="My orders"
            columns={[
              {
                label: 'Order',
                sortValue: (sale) => sale.id,
                render: (sale) => (
                  <>
                    <strong>{sale.detail}</strong>
                    <small>{sale.id}</small>
                  </>
                ),
              },
              { label: 'Date', sortValue: (sale) => sale.date, render: (sale) => sale.date },
              {
                label: 'Order progress',
                sortValue: (sale) => sale.orderStatus || 'Requested',
                render: (sale) => <RecordStatus status={sale.orderStatus || 'Requested'} />,
              },
              {
                label: 'Payment',
                sortValue: (sale) => sale.paymentStatus ?? sale.status,
                render: (sale) => <RecordStatus status={sale.paymentStatus ?? sale.status} />,
              },
              {
                label: 'Total',
                sortValue: (sale) => sale.total,
                render: (sale) => formatPHP(sale.total),
                numeric: true,
              },
              {
                label: 'QR / receipt',
                render: (sale) => (
                  <button
                    className="text-button"
                    aria-label={`Order QR and receipt ${sale.id}`}
                    onClick={() => setInvoice(sale)}
                  >
                    <Printer size={18} />
                    View details
                  </button>
                ),
              },
            ]}
          />
        )}
      </Panel>
      {invoice && <InvoiceDialog sale={invoice} onClose={() => setInvoice(null)} />}
    </>
  )
}
