import { Printer } from 'lucide-react'
import { useState } from 'react'
import { DataTable } from '../../components/ui/DataTable'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { StatStrip } from '../../components/ui/StatStrip'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useListFilters } from '../../hooks/useListFilters'
import { useWorkspace } from '../../hooks/useWorkspace'
import { prepareExcel } from '../../lib/excel'
import { formatDate, formatPHP } from '../../lib/format'
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

  return (
    <>
      <PageHeader
        eyebrow="POS LEDGER"
        title="Sales"
        description="Every invoice and payment collected through the point of sale."
      ></PageHeader>
      <StatStrip
        stats={[
          { label: 'Total sales', value: formatPHP(summary.salesTotal, true) },
          { label: 'Payments received', value: formatPHP(summary.received, true) },
          { label: 'Revenue excluding tax', value: formatPHP(summary.revenue, true) },
          { label: 'Transactions', value: sales.length },
        ]}
      />
      <ListToolbar
        {...filters}
        label="Search sales"
        count={filtered.length}
        onReset={filters.reset}
        options={['all', 'Paid', 'Partial', 'Unpaid'].map((value) => ({
          value,
          label: value === 'all' ? 'All payments' : value,
        }))}
        onExport={() =>
          prepareExcel('sales', [
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
      />
      <Panel
        title="POS sales ledger"
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
                  <small>
                    {sale.id} · {sale.detail}
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
                    className="icon-button"
                    aria-label={`Invoice ${sale.id}`}
                    title="View invoice"
                    onClick={() => setInvoice(sale)}
                  >
                    <Printer size={17} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Panel>
      {invoice && <InvoiceDialog sale={invoice} onClose={() => setInvoice(null)} />}
    </>
  )
}
