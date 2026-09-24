import { useState } from 'react'
import { EntryForm } from '../../components/ui/EntryForm'
import type { Expense } from '../../types/business'
import { useWorkspace } from '../../lib/workspaceStorage'
import { Plus, Pencil } from 'lucide-react'
import { formatPHP } from '../../data/appData'
import { prepareExcel, formatDate, getSummary } from '../../lib/business'
import { useListFilters } from '../../hooks/useListFilters'
import { Panel } from '../../components/ui/Panel'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/ui/DataTable'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { StatStrip } from '../../components/ui/StatStrip'

export function ExpensesPage({ onCreate }: { onCreate: () => void }) {
  const [editing, setEditing] = useState<Expense | null>(null)
  const workspace = useWorkspace()
  const { expenses } = workspace
  const filters = useListFilters()
  const summary = getSummary('', workspace)
  const categories = [...new Set(expenses.map(expense => expense.category))]
  const filtered = expenses.filter(expense => filters.matches([expense.description, expense.id, expense.method].join(' ')) && (filters.filter === 'all' || expense.category === filters.filter))
  return <>
    <PageHeader eyebrow="MONEY OUT" title="Expenses" description="See where your money goes, down to the last peso."><button className="primary-button" onClick={onCreate}><Plus size={18} />Record expense</button></PageHeader>
    <StatStrip stats={[{ label: 'Recorded expenses', value: formatPHP(summary.spent, true) }, { label: 'Entries', value: expenses.length }, { label: 'Categories', value: categories.length }, { label: 'Payment methods', value: new Set(expenses.map(expense => expense.method)).size }]} />
    <ListToolbar {...filters} label="Search expenses" count={filtered.length} onReset={filters.reset}
      options={[{ value: 'all', label: 'All categories' }, ...categories.map(value => ({ value, label: value }))]}
      onExport={() => prepareExcel('expenses', [['Reference', 'Description', 'Date', 'Category', 'Method', 'Amount PHP'], ...filtered.map(expense => [expense.id, expense.description, expense.date, expense.category, expense.method, expense.amount])])} />
    <Panel title="Operating expenses" subtitle="Workshop spending">
      <DataTable filtered={!!filters.query || filters.filter !== 'all'} rows={filtered} label="Operating expenses" columns={[
        { label: 'Description', sortValue: expense => expense.description, render: expense => <><strong>{expense.description}</strong><small>{expense.id} · {formatDate(expense.date)}</small></> },
        { label: 'Category', sortValue: expense => expense.category, render: expense => expense.category },
        { label: 'Paid through', sortValue: expense => expense.method, render: expense => <span className="payment-method">{expense.method}</span> },
        { label: 'Amount', sortValue: expense => expense.amount, numeric: true, render: expense => <strong>{formatPHP(expense.amount)}</strong> },
        { label: 'Actions', render: record => <button className="text-button" onClick={() => setEditing(record)} title="Edit expense" aria-label={`Edit ${record.id}`}><Pencil size={18}/></button> },
      ]} />
    </Panel>
    {editing && <EntryForm initialType="expense" record={editing} onClose={() => setEditing(null)} />}
  </>
}
