import { ExcelButton } from '../../components/ui/ExcelButton'
import { useWorkspace, currentPeriod } from '../../lib/workspaceStorage'
import { useSearchParams } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { formatPHP } from '../../data/appData'
import { prepareExcel, getSummary } from '../../lib/business'
import { Panel } from '../../components/ui/Panel'
import { PageHeader } from '../../components/ui/PageHeader'
import { PeriodSelect } from '../../components/ui/Filters'

export function ReportsPage() {
  const workspace = useWorkspace()
  const [params, setParams] = useSearchParams()
  const requested = params.get('period') ?? currentPeriod()
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentPeriod()
  const summary = getSummary(period, workspace)
  const categoryTotals = new Map<string, number>()
  for (const expense of summary.expenses) categoryTotals.set(expense.category, (categoryTotals.get(expense.category) ?? 0) + expense.amount)
  const exportRows = [['Metric', 'PHP'], ['Revenue excluding sales tax', summary.revenue], ['Sales tax', summary.taxCollected], ['Invoice totals', summary.salesTotal], ['Cost of sales', summary.cost], ['Expenses', summary.spent], ['Profit before tax', summary.profit], ['Payments received', summary.received], ['Outstanding', summary.outstanding]]
  return <>
    <PageHeader eyebrow="THE BIG PICTURE" title="Reports" description="Understand what you earned, spent, and still need to collect.">
      <PeriodSelect value={period} onChange={value => setParams({ period: value })} /><ExcelButton onExport={() => prepareExcel('report-' + period, exportRows)} />
    </PageHeader>
    <div className="report-highlight"><div><span className="eyebrow">NET PROFIT BEFORE TAX</span><strong>{formatPHP(summary.profit)}</strong><small>{summary.revenue ? (summary.profit / summary.revenue * 100).toFixed(1) : '0.0'}% margin · {summary.sales.length} recorded sales</small></div><BarChart3 size={54} strokeWidth={1.2} aria-hidden="true" /></div>
    <div className="reports-grid">
      <Panel title="Profit summary" subtitle="Revenue less recorded costs"><div className="report-rows"><div><span>Revenue excluding sales tax</span><b>{formatPHP(summary.revenue)}</b></div><div><span>Cost of sales</span><b>− {formatPHP(summary.cost)}</b></div><div><span>Operating expenses</span><b>− {formatPHP(summary.spent)}</b></div><div className="report-total"><span>Net profit</span><strong>{formatPHP(summary.profit)}</strong></div></div></Panel>
      <Panel title="Payment collection" subtitle="Payments against sales in this period"><div className="report-rows"><div><span>Sales total</span><b>{formatPHP(summary.salesTotal)}</b></div><div><span>Payments received</span><b>{formatPHP(summary.received)}</b></div><div><span>Sales with a balance</span><b>{summary.unpaid}</b></div><div><span>Sales tax on invoices</span><b>{formatPHP(summary.taxCollected)}</b></div><div className="report-total"><span>Outstanding</span><strong>{formatPHP(summary.outstanding)}</strong></div></div></Panel>
    </div>
    <Panel title="Expense breakdown" subtitle="Where operating spend is going"><div className="expense-summary"><span>Operating expenses</span><strong>{formatPHP(summary.spent)}</strong><small>{summary.expenses.length} entries / {categoryTotals.size} categories</small></div><div className="expense-breakdown">{[...categoryTotals].sort((a,b) => b[1]-a[1]).map(([category, amount]) => <div key={category}><div><span>{category}</span><strong>{formatPHP(amount)} <small>{summary.spent ? (amount / summary.spent * 100).toFixed(1) : "0"}%</small></strong></div><progress aria-label={category + ' share of expenses'} value={amount} max={summary.spent || 1} /></div>)}{!summary.expenses.length && <p>No expenses recorded in this period.</p>}</div></Panel>
  </>
}
