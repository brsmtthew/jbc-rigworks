import { useWorkspace, currentPeriod } from '../../lib/workspaceStorage'
import { useSearchParams } from 'react-router-dom'
import { BriefcaseBusiness, Coins, TrendingUp } from 'lucide-react'
import { formatPHP } from '../../data/appData'
import { getSummary } from '../../lib/business'
import { MetricCard } from '../../components/ui/MetricCard'
import { Panel } from '../../components/ui/Panel'
import { PageHeader } from '../../components/ui/PageHeader'
import { PeriodSelect } from '../../components/ui/Filters'
import { RevenueChart } from './RevenueChart'
export function DashboardPage() {
  const workspace = useWorkspace()
  const [params, setParams] = useSearchParams()
  const requested = params.get('period') ?? currentPeriod()
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentPeriod()
  const summary = getSummary(period, workspace)
  const jobCounts = ['Queued', 'In progress', 'Ready', 'Completed'].map(label => ({ label, value: workspace.jobs.filter(job => job.status === label).length }))
  const low = workspace.inventory.filter(item => item.stock <= item.minimum).length
  const channels = ['Walk-in', 'Online'].map(label => ({ label, value: summary.sales.filter(sale => (sale.channel ?? 'Walk-in') === label).reduce((sum, sale) => sum + sale.total, 0) }))
  return <>
    <PageHeader eyebrow="WORKSHOP ANALYTICS" title="Dashboard" description="Sales, profitability, stock, and service activity."><PeriodSelect value={period} onChange={value => setParams({ period: value })} /></PageHeader>
    <div className="metric-grid">
      <MetricCard label="Revenue" value={formatPHP(summary.revenue, true)} note={summary.sales.length + ' sales this period'} icon={TrendingUp} />
      <MetricCard label="Payments received" value={formatPHP(summary.received, true)} note="Against selected sales" icon={Coins} />
      <MetricCard label="Outstanding" value={formatPHP(summary.outstanding, true)} note={summary.unpaid + ' unpaid or partially paid sales'} icon={BriefcaseBusiness} />
      <MetricCard label="Net profit" value={formatPHP(summary.profit, true)} note="After recorded costs, before tax" icon={TrendingUp} dark />
    </div>
    <div className="analytics-grid">
      <Panel title="Sales & collections" subtitle="Daily totals for every calendar day in the selected month" className="chart-panel" action={<div className="chart-legend"><span><i className="legend-blue" />Sales</span><span><i className="legend-teal" />Collections</span></div>}><RevenueChart sales={workspace.sales} period={period} /></Panel>
      <Panel title="Service activity" subtitle="All current jobs"><div className="analytics-rows">{jobCounts.map(row => <div key={row.label}><span>{row.label}</span><strong>{row.value}</strong><meter min={0} max={Math.max(1, workspace.jobs.length)} value={row.value} aria-label={row.label} /></div>)}</div></Panel>
      <Panel title="Sales by channel" subtitle="Invoice totals, including tax"><div className="analytics-rows">{channels.map(row => <div key={row.label}><span>{row.label}</span><strong>{formatPHP(row.value)}</strong><meter min={0} max={Math.max(1, ...channels.map(row => row.value))} value={row.value} aria-label={row.label} /></div>)}</div></Panel>
      <Panel title="Inventory health" subtitle="Current stock across all categories"><dl className="detail-list"><div><dt>Stock value at cost</dt><dd>{formatPHP(workspace.inventory.reduce((sum, item) => sum + item.stock * item.cost, 0))}</dd></div><div><dt>Unique items</dt><dd>{workspace.inventory.length}</dd></div><div><dt>Low-stock items</dt><dd>{low}</dd></div><div><dt>Out of stock</dt><dd>{workspace.inventory.filter(item => item.stock === 0).length}</dd></div></dl></Panel>
    </div>
  </>
}
