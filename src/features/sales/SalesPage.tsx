import { InvoiceDialog } from './InvoiceDialog'
import { Banknote, Printer, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import type { Sale } from '../../types/business'
import { useWorkspace } from '../../lib/workspaceStorage'
import { formatPHP } from '../../data/appData'
import { prepareExcel, formatDate, getSummary } from '../../lib/business'
import { useListFilters } from '../../hooks/useListFilters'
import { Panel } from '../../components/ui/Panel'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { StatStrip } from '../../components/ui/StatStrip'
import { useNavigate } from 'react-router-dom'

export function SalesPage() {
  const [invoice, setInvoice] = useState<Sale | null>(null)
  const navigate = useNavigate()
  const workspace = useWorkspace()
  const { sales } = workspace
  const filters = useListFilters()
  const summary = getSummary('', workspace)
  const filtered = sales.filter(sale => filters.matches([sale.id, sale.customer, sale.detail].join(' ')) && (filters.filter === 'all' || sale.status === filters.filter))

  return <>
    <PageHeader eyebrow="POS LEDGER" title="Sales & payments" description="Every invoice and payment collected through the point of sale.">
      <button className="primary-button" onClick={() => navigate('/pos')}><ShoppingCart size={18} />Open POS</button>
    </PageHeader>
    <StatStrip stats={[
      { label: 'Total sales', value: formatPHP(summary.salesTotal, true) },
      { label: 'Payments received', value: formatPHP(summary.received, true) },
      { label: 'Outstanding', value: formatPHP(summary.outstanding, true) },
      { label: 'Transactions', value: sales.length },
    ]} />
    <ListToolbar {...filters} label="Search sales" count={filtered.length} onReset={filters.reset}
      options={['all', 'Paid', 'Partial', 'Unpaid'].map(value => ({ value, label: value === 'all' ? 'All payments' : value }))}
      onExport={() => prepareExcel('sales', [['Reference', 'Customer', 'Date', 'Channel', 'Status', 'Payment method', 'Tax PHP', 'Total PHP', 'Paid PHP', 'Balance PHP'], ...filtered.map(sale => [sale.id, sale.customer, sale.date, sale.channel ?? 'Walk-in', sale.status, sale.paymentMethod ?? '', sale.charges?.tax ?? 0, sale.total, sale.paid, sale.total - sale.paid])])} />
    <Panel title="POS sales ledger" subtitle="Open balances can be collected from the cashier screen.">
      {sales.length ? <DataTable filtered={!!filters.query || filters.filter !== 'all'} rows={filtered} label="Sales ledger" columns={[
        { label: 'Customer / reference', sortValue: sale => sale.customer, render: sale => <><strong>{sale.customer}</strong><small>{sale.id} · {sale.detail}</small></> },
        { label: 'Date / channel', sortValue: sale => sale.date, render: sale => <>{formatDate(sale.date)}<small>{sale.channel ?? 'Walk-in'}</small></> },
        { label: 'Payment', sortValue: sale => sale.status, render: sale => <><StatusBadge tone={sale.status === 'Paid' ? 'green' : sale.status === 'Partial' ? 'amber' : 'gray'}>{sale.status}</StatusBadge><small>{sale.paymentMethod || 'Method not recorded'}{sale.paymentHistory?.length ? ` · ${sale.paymentHistory.length} payment${sale.paymentHistory.length === 1 ? '' : 's'}` : ''}</small></> },
        { label: 'Balance', sortValue: sale => sale.total - sale.paid, numeric: true, render: sale => formatPHP(Math.max(0, sale.total - sale.paid)) },
        { label: 'Total', sortValue: sale => sale.total, numeric: true, render: sale => <strong>{formatPHP(sale.total)}</strong> },
        { label: 'Actions', render: sale => <div className="row-actions">
          {sale.total > sale.paid && <button className="text-button sales-collect-action" onClick={() => navigate('/pos', { state: { collectSaleId: sale.id } })}><Banknote size={17} />Collect</button>}
          <button className="icon-button" aria-label={`Invoice ${sale.id}`} title="View invoice" onClick={() => setInvoice(sale)}><Printer size={17} /></button>
        </div> },
      ]} /> : <div className="empty-state"><ShoppingCart size={26}/><h3>No POS transactions yet</h3><p>Start a sale or service invoice in POS to build the ledger.</p><button className="primary-button" onClick={() => navigate('/pos')}><ShoppingCart size={18}/>Open POS</button></div>}
    </Panel>
    {invoice && <InvoiceDialog sale={invoice} onClose={() => setInvoice(null)} />}
  </>
}
