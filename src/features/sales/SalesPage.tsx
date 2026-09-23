import { InvoiceDialog } from './InvoiceDialog'
import { Printer, Pencil } from 'lucide-react'
import { useState } from 'react'
import { EntryForm } from '../../components/ui/EntryForm'
import type { Sale } from '../../types/business'
import { useWorkspace } from '../../lib/workspaceStorage'
import { Plus } from 'lucide-react'
import { formatPHP } from '../../data/appData'
import { prepareExcel, formatDate, getSummary } from '../../lib/business'
import { useListFilters } from '../../hooks/useListFilters'
import { Panel } from '../../components/ui/Panel'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { StatStrip } from '../../components/ui/StatStrip'

export function SalesPage({ onCreate }: { onCreate: () => void }) {
  const [invoice, setInvoice] = useState<Sale | null>(null)
  const [editing, setEditing] = useState<Sale | null>(null)
  const workspace = useWorkspace()
  const { sales } = workspace
  const filters = useListFilters()
  const summary = getSummary('', workspace)
  const filtered = sales.filter(sale => filters.matches([sale.id, sale.customer, sale.detail].join(' ')) && (filters.filter === 'all' || sale.status === filters.filter))
  return <>
    <PageHeader eyebrow="MONEY IN" title="Sales & payments" description="Every sale accounted for. Every payment in view."><button className="primary-button" onClick={onCreate} title="Record sale" aria-label="Record sale"><Plus size={20} /></button></PageHeader>
    <StatStrip stats={[{ label: 'Total sales', value: formatPHP(summary.salesTotal, true) }, { label: 'Payments received', value: formatPHP(summary.received, true) }, { label: 'Outstanding', value: formatPHP(summary.outstanding, true) }, { label: 'Transactions', value: sales.length }]} />
    <ListToolbar {...filters} label="Search sales" count={filtered.length} onReset={filters.reset}
      options={['all', 'Paid', 'Partial', 'Unpaid'].map(value => ({ value, label: value === 'all' ? 'All payments' : value }))}
      onExport={() => prepareExcel('sales', [['Reference', 'Customer', 'Date', 'Channel', 'Status', 'Tax PHP', 'Total PHP', 'Paid PHP', 'Balance PHP'], ...filtered.map(sale => [sale.id, sale.customer, sale.date, sale.channel ?? 'Walk-in', sale.status, sale.charges?.tax ?? 0, sale.total, sale.paid, sale.total - sale.paid])])} />
    <Panel title="Sales ledger" subtitle="Sales and payment history">
      <DataTable filtered={!!filters.query || filters.filter !== 'all'} rows={filtered} label="Sales ledger" columns={[
        { label: 'Customer / reference', sortValue: sale => sale.customer, render: sale => <><strong>{sale.customer}</strong><small>{sale.id} · {sale.detail}</small></> },
        { label: 'Date / channel', sortValue: sale => sale.date, render: sale => <>{formatDate(sale.date)}<small>{sale.channel ?? 'Walk-in'}</small></> },
        { label: 'Payment', sortValue: sale => sale.status, render: sale => <StatusBadge tone={sale.status === 'Paid' ? 'green' : sale.status === 'Partial' ? 'amber' : 'gray'}>{sale.status}</StatusBadge> },
        { label: 'Balance', sortValue: sale => sale.total - sale.paid, numeric: true, render: sale => formatPHP(sale.total - sale.paid) },
        { label: 'Total', sortValue: sale => sale.total, numeric: true, render: sale => <strong>{formatPHP(sale.total)}</strong> },
        { label: 'Actions', render: record => <div className="row-actions"><button className="text-button" onClick={() => setEditing(record)} title="Edit payment" aria-label={`Edit ${record.id}`}><Pencil size={18}/></button><button className="icon-button" aria-label={`Invoice ${record.id}`} title="View invoice" onClick={() => setInvoice(record)}><Printer size={17} /></button></div> },
      ]} />
    </Panel>
    {invoice && <InvoiceDialog sale={invoice} onClose={() => setInvoice(null)} />}
    {editing && <EntryForm initialType="sale" record={editing} onClose={() => setEditing(null)} />}
  </>
}
