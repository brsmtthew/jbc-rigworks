import { where } from 'firebase/firestore'
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExcelButton } from '../../components/ui/ExcelButton'
import { Dialog } from '../../components/ui/Dialog'
import { LoadingState } from '../../components/ui/LoadingState'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useWorkspace } from '../../hooks/useWorkspace'
import { currentPeriod, manilaDay, today } from '../../lib/dates'
import { prepareExcel } from '../../lib/excel'
import { formatPHP } from '../../lib/format'
import { availableStock, serviceState } from '../../lib/workflow'
import type { StockMovement } from '../../types'
import { useAllRequests } from '../customer/useCustomerRequests'
import {
  ColumnChart,
  DonutChart,
  RankedBars,
  ReportCard,
  SegmentedChart,
  TrendChart,
} from './ReportCharts'
import { reportColors } from './reportChartColors'
import { getSummary } from './summary'

export function ReportsPage() {
  const workspace = useWorkspace()
  const [params, setParams] = useSearchParams()
  const requested = params.get('period') ?? currentPeriod()
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentPeriod()
  const [range, setRange] = useState('month'),
    [from, setFrom] = useState(today()),
    [to, setTo] = useState(today())
  const [customOpen, setCustomOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const openCustomRange = () => {
    setDraftFrom(from)
    setDraftTo(to)
    setCustomOpen(true)
  }
  const weekStart = new Date(today() + 'T12:00:00Z')
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
  const start =
    range === 'custom'
      ? from
      : range === 'today'
        ? today()
        : range === 'week'
          ? weekStart.toISOString().slice(0, 10)
          : period + '-01'
  const monthEnd = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate()
  const end = range === 'custom' ? to : range === 'month' ? `${period}-${monthEnd}` : today()
  const requests = useAllRequests(true)
  // ISO UTC timestamps are stored by the ledger. Bounds represent Manila days.
  const validRange = !!start && !!end && start <= end
  const since = validRange ? new Date(`${start}T00:00:00+08:00`).toISOString() : ''
  const until = validRange ? new Date(`${end}T23:59:59.999+08:00`).toISOString() : ''
  const movements = useLiveCollection<StockMovement>(
    'stockMovements',
    validRange,
    [where('timestamp', '>=', since), where('timestamp', '<=', until)],
    `${since}/${until}`,
  )
  const serviceJobs = workspace.jobs.filter((job) => job.due >= start && job.due <= end)
  const buildRequests = requests.requests.filter((request) => {
    const date = manilaDay(request.createdAt ?? '')
    return date >= start && date <= end
  })
  const lowStock = workspace.inventory.filter(
    (item) => item.active !== false && availableStock(item) <= item.minimum,
  )
  const summary = getSummary('', {
    sales: workspace.sales.filter((sale) => sale.date >= start && sale.date <= end),
    expenses: workspace.expenses.filter((expense) => expense.date >= start && expense.date <= end),
  })
  const categoryTotals = new Map<string, number>()
  for (const expense of summary.expenses)
    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) ?? 0) + expense.amount,
    )
  const itemCategories = new Map<string, number>(),
    dailySales = new Map<string, number>()
  for (const sale of summary.sales) {
    dailySales.set(sale.date, (dailySales.get(sale.date) ?? 0) + sale.total)
    for (const line of sale.lines ?? []) {
      const category = line.category || (line.inventoryId ? 'Legacy / uncategorized' : 'Services')
      itemCategories.set(
        category,
        (itemCategories.get(category) ?? 0) + line.unitPrice * line.quantity,
      )
    }
  }
  const serviceStages = ['Checked in', 'In service', 'Ready for checkout', 'Completed']
  const serviceCounts = serviceStages.map((label, index) => ({
    label,
    value: serviceJobs.filter((job) => serviceState(job.status) === label).length,
    color: reportColors[index],
  }))
  const buildCounts = [...new Set(buildRequests.map((request) => request.status))]
    .map((label, index) => ({
      label,
      value: buildRequests.filter((request) => request.status === label).length,
      color: reportColors[index % reportColors.length],
    }))
    .sort((a, b) => b.value - a.value)
  const movementCounts = [...new Set(movements.rows.map((movement) => movement.type))]
    .map((type, index) => ({
      label: type.replaceAll('_', ' '),
      value: movements.rows.filter((movement) => movement.type === type).length,
      color: reportColors[index % reportColors.length],
    }))
    .sort((a, b) => b.value - a.value)
  const activeInventoryCount = workspace.inventory.filter((item) => item.active !== false).length
  const stockAttentionShare = activeInventoryCount ? (lowStock.length / activeInventoryCount) * 100 : 0
  const paymentMethods = [...new Set(summary.sales.map((sale) => sale.paymentMethod ?? 'Not recorded'))]
    .map((label, index) => ({
      label,
      value: summary.sales
        .filter((sale) => (sale.paymentMethod ?? 'Not recorded') === label)
        .reduce((sum, sale) => sum + sale.total, 0),
      color: reportColors[index % reportColors.length],
    }))
    .sort((a, b) => b.value - a.value)
  const salesChannels = ['Walk-in', 'Online'].map((label, index) => ({
    label,
    value: summary.sales
      .filter((sale) => (sale.channel ?? 'Walk-in') === label)
      .reduce((sum, sale) => sum + sale.total, 0),
    color: reportColors[index],
  }))
  const itemSales = [...itemCategories]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({ label, value, color: reportColors[index % reportColors.length] }))
  const salesTrend = [...dailySales]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }))
  const expenseCategories = [...categoryTotals]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({ label, value, color: reportColors[index % reportColors.length] }))
  const profitBridge = [
    { label: 'Revenue excluding tax', value: summary.revenue, color: '#176fce' },
    { label: 'Cost of sales', value: summary.cost, color: '#efaa54' },
    { label: 'Operating expenses', value: summary.spent, color: '#d96979' },
    { label: 'Net profit', value: summary.profit, color: '#42a479' },
  ]
  const profitScale = Math.max(1, ...profitBridge.map((item) => Math.abs(item.value)))
  const outstanding = Math.max(0, summary.salesTotal - summary.received)
  const collectionShare = summary.salesTotal
    ? Math.min(100, Math.max(0, (summary.received / summary.salesTotal) * 100))
    : 0
  const exportRows = [
    ['Metric', 'PHP'],
    ['Revenue excluding sales tax', summary.revenue],
    ['Sales tax', summary.taxCollected],
    ['Invoice totals', summary.salesTotal],
    ['Cost of sales', summary.cost],
    ['Expenses', summary.spent],
    ['Profit before tax', summary.profit],
    ['Payments received', summary.received],
    ['Gross profit', summary.revenue - summary.cost],
  ]
  exportRows.push(
    ['', ''],
    ['Period start', start],
    ['Period end', end],
    ['', ''],
    ['Item category (before adjustments)', 'PHP'],
    ...[...itemCategories],
    ['', ''],
    ['Paid sales date', 'PHP'],
    ...[...dailySales].sort(([a], [b]) => a.localeCompare(b)),
  )
  exportRows.push(
    ['', ''],
    ['Operational metric', 'Count'],
    ['Services by target date', serviceJobs.length],
    ['Build requests by creation date', buildRequests.length],
    ['Stock movements', movements.rows.length],
    ['Current low-stock items', lowStock.length],
  )
  return (
    <div className="admin-reports-page">
      <section className="admin-reports-hero jbc-blue-hero" aria-labelledby="admin-reports-title">
        <div className="admin-reports-hero-copy">
          <span className="admin-reports-kicker">WORKSHOP PERFORMANCE</span>
          <h1 id="admin-reports-title">Reports</h1>
          <p>Understand sales, costs, profit, and workshop activity for any period.</p>
        </div>
        <div className="admin-reports-hero-actions admin-hero-tool-panel" role="group" aria-label="Report tools">
          <span className="admin-reports-hero-actions-label"><CalendarDays size={14} aria-hidden="true" /> REPORT PERIOD</span>
          <div className={`admin-reports-period-inputs${range === 'month' ? ' with-month' : ''}${range === 'custom' ? ' with-custom' : ''}`}>
            <select
              aria-label="Report date range"
              value={range}
              onChange={(e) => {
                if (e.target.value === 'custom') openCustomRange()
                else setRange(e.target.value)
              }}
            >
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="custom">Custom range</option>
            </select>
            {range === 'month' && (
              <input
                aria-label="Report month"
                type="month"
                value={period}
                onChange={(e) => setParams({ period: e.target.value })}
              />
            )}
            {range === 'custom' && (
              <button type="button" className="admin-reports-custom-trigger" onClick={openCustomRange}>
                <CalendarDays size={14} aria-hidden="true" /> {from} to {to} · Edit dates
              </button>
            )}
          </div>
          <ExcelButton
            disabled={!validRange}
            onExport={() => prepareExcel('report-' + start + '-to-' + end, exportRows)}
          />
        </div>
      </section>
      {customOpen && (
        <Dialog
          title="Custom report dates"
          onClose={() => setCustomOpen(false)}
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setCustomOpen(false)}>Cancel</button>
              <button type="submit" className="primary-button" form="admin-report-dates" disabled={!draftFrom || !draftTo || draftFrom > draftTo}>Apply dates</button>
            </>
          }
        >
        <form
          id="admin-report-dates"
          className="admin-reports-custom-range"
          onSubmit={(event) => {
            event.preventDefault()
            if (!draftFrom || !draftTo || draftFrom > draftTo) return
            setFrom(draftFrom)
            setTo(draftTo)
            setRange('custom')
            setCustomOpen(false)
          }}
        >
          <div>
            <span className="eyebrow">CUSTOM PERIOD</span>
            <strong>Choose report dates</strong>
          </div>
          <label>
            From date
            <input
              aria-label="From date"
              type="date"
              value={draftFrom}
              max={draftTo || undefined}
              onChange={(e) => setDraftFrom(e.target.value)}
            />
          </label>
          <label>
            To date
            <input
              aria-label="To date"
              type="date"
              min={draftFrom}
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
            />
          </label>
          {draftFrom > draftTo && (
            <p className="form-error" role="alert">
              The end date must be on or after the start date.
            </p>
          )}
        </form>
        </Dialog>
      )}
      {(workspace.storageError || requests.error) && (
        <p role="alert" className="form-error">
          {workspace.storageError || requests.error}
        </p>
      )}
      <section className="admin-reports-summary" aria-label="Financial snapshot">
        <div className="admin-reports-profit">
          <span className="eyebrow">NET PROFIT BEFORE TAX</span>
          <strong>{formatPHP(summary.profit)}</strong>
          <small>
            {summary.revenue ? ((summary.profit / summary.revenue) * 100).toFixed(1) : '0.0'}%
            margin · {summary.sales.length} recorded sales
          </small>
        </div>
        <dl className="admin-reports-summary-metrics">
          <div>
            <dt>Revenue</dt>
            <dd>{formatPHP(summary.revenue)}</dd>
          </div>
          <div>
            <dt>Payments received</dt>
            <dd>{formatPHP(summary.received)}</dd>
          </div>
          <div>
            <dt>Operating expenses</dt>
            <dd>{formatPHP(summary.spent)}</dd>
          </div>
        </dl>
      </section>
      <div className="admin-reports-section-heading">
        <span className="eyebrow">OPERATIONS</span>
        <h2>Workshop activity</h2>
      </div>
      <div className="report-viz-grid report-viz-grid-operations">
        <ReportCard
          kicker="01 / SERVICE FLOW"
          title="Service activity"
          description="Jobs with target dates in this period, grouped by current status."
          tone="blue"
        >
          <DonutChart items={serviceCounts} centerLabel="jobs" centerValue={serviceJobs.length} />
        </ReportCard>
        <ReportCard
          kicker="02 / BUILD PIPELINE"
          title="PC build activity"
          description="Requests created in this period, grouped by current status."
          tone="violet"
        >
          <div className="report-viz-lead">
            <strong>{buildRequests.length}</strong>
            <span>build {buildRequests.length === 1 ? 'request' : 'requests'}</span>
          </div>
          <RankedBars items={buildCounts} emptyMessage="No build requests created in this period." />
        </ReportCard>
        <ReportCard
          kicker="03 / STOCK LEDGER"
          title="Inventory movements"
          description="Recorded stock changes during the selected period."
          tone="teal"
        >
          {movements.error ? (
            <p role="alert" className="form-error">{movements.error}</p>
          ) : movements.loading ? (
            <LoadingState variant="compact" label="Loading movements…" />
          ) : (
            <ColumnChart items={movementCounts} emptyMessage="No stock movements in this period." />
          )}
        </ReportCard>
        <ReportCard
          kicker="04 / LIVE INVENTORY"
          title="Current stock attention"
          description="Live availability across active items, independent of report dates."
          tone="amber"
        >
          <div className="report-stock-readout">
            <strong>{lowStock.length}</strong>
            <span>of {activeInventoryCount} active items at or below minimum</span>
          </div>
          <div className="report-stock-meter" aria-hidden="true">
            <span style={{ width: `${stockAttentionShare}%` }} />
          </div>
          <div className="report-stock-footer">
            <span>{stockAttentionShare.toFixed(0)}% need attention</span>
            <Link to="/inventory?filter=low">Review low stock</Link>
          </div>
        </ReportCard>
      </div>
      <div className="admin-reports-section-heading">
        <span className="eyebrow">FINANCES</span>
        <h2>Revenue and costs</h2>
      </div>
      <div className="report-viz-grid report-viz-grid-finances">
        <ReportCard
          kicker="01 / PROFIT BRIDGE"
          title="How revenue becomes profit"
          description="Revenue excluding tax, less direct costs and operating expenses."
          tone="green"
        >
          <div className="report-profit-bridge">
            {profitBridge.map((item) => (
              <div className="report-profit-step" key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{formatPHP(item.value)}</strong>
                </div>
                <div className="report-profit-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${(Math.abs(item.value) / profitScale) * 100}%`,
                      background: item.value < 0 ? '#d96979' : item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ReportCard>
        <ReportCard
          kicker="02 / COLLECTION"
          title="Payment collection"
          description="Payments received against recognized invoice totals."
          tone="blue"
        >
          <div className="report-collection-head">
            <strong>{collectionShare.toFixed(0)}%</strong>
            <span>of {formatPHP(summary.salesTotal)} collected</span>
          </div>
          <SegmentedChart
            items={[
              { label: 'Received', value: summary.received, color: '#176fce' },
              { label: 'Balance', value: outstanding, color: '#efaa54' },
            ]}
            formatValue={formatPHP}
            emptyMessage="No recognized sales in this period."
          />
          <div className="report-collection-footnotes">
            <span>{summary.sales.length} recorded sales</span>
            <span>{formatPHP(summary.taxCollected)} sales tax</span>
            <span>{formatPHP(summary.revenue - summary.cost)} gross profit</span>
          </div>
        </ReportCard>
        <ReportCard
          kicker="03 / PAYMENT MIX"
          title="Payment methods"
          description="Recognized invoice value by recorded payment method."
          tone="violet"
        >
          <SegmentedChart
            items={paymentMethods}
            formatValue={formatPHP}
            emptyMessage="No payment methods recorded in this period."
          />
        </ReportCard>
        <ReportCard
          kicker="04 / SALES CHANNELS"
          title="Where sales originate"
          description="Recognized invoice totals by sales channel."
          tone="teal"
        >
          <ColumnChart
            items={salesChannels}
            formatValue={formatPHP}
            emptyMessage="No sales in this period."
          />
        </ReportCard>
        <ReportCard
          kicker="05 / CATEGORY SALES"
          title="Item sales by category"
          description="Line subtotals before invoice adjustments and tax."
          tone="amber"
        >
          <RankedBars
            items={itemSales}
            formatValue={formatPHP}
            emptyMessage="No item sales in this period."
          />
        </ReportCard>
        <ReportCard
          kicker="06 / DAILY TREND"
          title="Daily sales"
          description="Recognized invoice totals grouped by invoice date."
          tone="blue"
        >
          <TrendChart
            items={salesTrend}
            formatValue={formatPHP}
            emptyMessage="No sales in this period."
          />
        </ReportCard>
        <ReportCard
          kicker="07 / EXPENSE MIX"
          title="Where operating spend goes"
          description="Recorded expenses grouped by category."
          tone="green"
          className="report-viz-wide"
        >
          <div className="report-expense-head">
            <strong>{formatPHP(summary.spent)}</strong>
            <span>{summary.expenses.length} entries across {categoryTotals.size} categories</span>
          </div>
          <SegmentedChart
            items={expenseCategories}
            formatValue={formatPHP}
            emptyMessage="No expenses recorded in this period."
          />
        </ReportCard>
      </div>
    </div>
  )
}
