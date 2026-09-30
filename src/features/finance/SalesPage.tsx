import { Printer, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DataTable } from '../../components/ui/DataTable'
import { ExcelButton } from '../../components/ui/ExcelButton'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { Panel } from '../../components/ui/Panel'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useListFilters } from '../../hooks/useListFilters'
import { useWorkspace } from '../../hooks/useWorkspace'
import { prepareExcel } from '../../lib/excel'
import { formatDate, formatPHP } from '../../lib/format'
import { shortReference } from '../../lib/reference'
import type { Sale } from '../../types'
import { InvoiceDialog } from './InvoiceDialog'
import { getSummary } from './summary'

export function SalesPage() {
  const [invoice, setInvoice] = useState<Sale | null>(null)
  const workspace = useWorkspace()
  const { sales } = workspace
  const filters = useListFilters()
  const summary = getSummary('', workspace)
  const filtered = sales.filter(
    (sale) =>
      filters.matches([sale.id, sale.customer, sale.detail].join(' ')) &&
      (filters.filter === 'all' || sale.status === filters.filter),
  )
  const metrics = [
    { label: 'Total sales', value: formatPHP(summary.salesTotal, true), note: 'Recognized invoice totals' },
    { label: 'Payments received', value: formatPHP(summary.received, true), note: 'Collected on recognized sales' },
    { label: 'Revenue excluding tax', value: formatPHP(summary.revenue, true), note: 'Sales less recorded tax' },
    { label: 'Transactions', value: sales.length, note: 'All records in this ledger' },
  ]

  function exportSales() {
    return prepareExcel('sales', [
      [
        'Reference',
        'Customer',
        'Date',
        'Channel',
        'Status',
        'Payment method',
        'Tax PHP',
        'Total PHP',
        'Paid PHP',
        'Balance PHP',
      ],
      ...filtered.map((sale) => [
        sale.id,
        sale.customer,
        sale.date,
        sale.channel ?? 'Walk-in',
        sale.status,
        sale.paymentMethod ?? '',
        sale.charges?.tax ?? 0,
        sale.total,
        sale.paid,
        sale.total - sale.paid,
      ]),
    ])
  }

  return (
    <div className="admin-sales-page">
      <section className="admin-sales-hero jbc-blue-hero" aria-labelledby="admin-sales-title">
        <div className="admin-sales-hero-copy">
          <span className="admin-sales-kicker">SALES &amp; PAYMENTS</span>
          <h1 id="admin-sales-title">Sales</h1>
          <p>Review invoices, collected payments, and balances across every sale.</p>
        </div>
        <div className="admin-sales-hero-actions admin-hero-tool-panel" role="group" aria-label="Sales actions">
          <span className="admin-sales-hero-actions-label">SALES TOOLS</span>
          <strong>{sales.length} {sales.length === 1 ? 'transaction' : 'transactions'} recorded</strong>
          <div>
            <Link className="primary-button" to="/pos"><ShoppingCart size={16} /> Open POS</Link>
            <ExcelButton disabled={!filtered.length} onExport={exportSales} />
          </div>
        </div>
      </section>
      <dl className="admin-sales-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            <small>{metric.note}</small>
          </div>
        ))}
      </dl>
      <section className="admin-sales-discovery discovery-card" aria-label="Find a sale">
        <div className="admin-sales-discovery-heading">
          <div>
            <span className="eyebrow">FIND A TRANSACTION</span>
            <h2>Search your sales</h2>
          </div>
          <span className="discovery-card-count" role="status">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</span>
        </div>
        <ListToolbar
          {...filters}
          label="Search sales"
          filterLabel="Payment status"
          onReset={filters.reset}
          options={['all', 'Paid', 'Partial', 'Unpaid'].map((value) => ({
            value,
            label: value === 'all' ? 'All payments' : value,
          }))}
        />
      </section>
      <Panel
        className="admin-sales-ledger"
        title="Sales ledger"
        subtitle="Transaction history, receipts, and payment snapshots."
      >
        <DataTable
          filtered={!!filters.query || filters.filter !== 'all'}
          rows={filtered}
          label="Sales ledger"
          columns={[
            {
              label: 'Customer / reference',
              sortValue: (sale) => sale.customer,
              render: (sale) => (
                <>
                  <strong>{sale.customer}</strong>
                  <small title={sale.id}>
                    {shortReference(sale.id)} · {sale.detail}
                  </small>
                </>
              ),
            },
            {
              label: 'Date / channel',
              sortValue: (sale) => sale.date,
              render: (sale) => (
                <>
                  {formatDate(sale.date)}
                  <small>{sale.channel ?? 'Walk-in'}</small>
                </>
              ),
            },
            {
              label: 'Payment',
              sortValue: (sale) => sale.status,
              render: (sale) => (
                <>
                  <StatusBadge
                    tone={
                      sale.status === 'Paid'
                        ? 'green'
                        : sale.status === 'Partial'
                          ? 'amber'
                          : 'gray'
                    }
                  >
                    {sale.status}
                  </StatusBadge>
                  <small>
                    {sale.paymentMethod || 'Method not recorded'}
                    {sale.paymentHistory?.length
                      ? ` · ${sale.paymentHistory.length} payment${sale.paymentHistory.length === 1 ? '' : 's'}`
                      : ''}
                  </small>
                </>
              ),
            },
            {
              label: 'Balance',
              sortValue: (sale) => sale.total - sale.paid,
              numeric: true,
              render: (sale) => formatPHP(Math.max(0, sale.total - sale.paid)),
            },
            {
              label: 'Total',
              sortValue: (sale) => sale.total,
              numeric: true,
              render: (sale) => <strong>{formatPHP(sale.total)}</strong>,
            },
            {
              label: 'Actions',
              render: (sale) => (
                <div className="row-actions">
                  <button
                    type="button"
                    className="secondary-button admin-sales-invoice-button"
                    aria-label={`View invoice ${sale.id}`}
                    onClick={() => setInvoice(sale)}
                  >
                    <Printer size={16} /> View invoice
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Panel>
      {invoice && <InvoiceDialog sale={invoice} onClose={() => setInvoice(null)} />}
    </div>
  )
}
