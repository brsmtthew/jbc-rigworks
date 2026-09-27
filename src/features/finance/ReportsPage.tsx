import { where } from 'firebase/firestore'
import { BarChart3 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExcelButton } from '../../components/ui/ExcelButton'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useWorkspace } from '../../hooks/useWorkspace'
import { currentPeriod, today } from '../../lib/dates'
import { prepareExcel } from '../../lib/excel'
import { formatPHP } from '../../lib/format'
import { availableStock, serviceState } from '../../lib/workflow'
import type { StockMovement } from '../../types'
import { useAllRequests } from '../customer/useCustomerRequests'
import { getSummary } from './summary'

export function ReportsPage() {
  const workspace = useWorkspace()
  const [params, setParams] = useSearchParams()
  const requested = params.get('period') ?? currentPeriod()
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentPeriod()
  const [range, setRange] = useState('month'),
    [from, setFrom] = useState(today()),
    [to, setTo] = useState(today())
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
  const end = range === 'custom' ? to : range === 'month' ? period + '-31' : today()
  const requests = useAllRequests(true)
  // ISO UTC timestamps are stored by the ledger. Bounds represent Manila days.
  const lastDay =
    range === 'month'
      ? new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate()
      : null
  const finalDate = lastDay ? `${period}-${lastDay}` : end
  const validRange = !!start && !!finalDate && start <= finalDate
  const since = validRange ? new Date(`${start}T00:00:00+08:00`).toISOString() : ''
  const until = validRange ? new Date(`${finalDate}T23:59:59.999+08:00`).toISOString() : ''
  const movements = useLiveCollection<StockMovement>(
    'stockMovements',
    validRange,
    [where('timestamp', '>=', since), where('timestamp', '<=', until)],
    `${since}/${until}`,
  )
  const serviceJobs = workspace.jobs.filter((job) => job.due >= start && job.due <= end)
  const buildRequests = requests.requests.filter((request) => {
    const date = (request.createdAt ?? '').slice(0, 10)
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
    <>
      <PageHeader
        eyebrow="THE BIG PICTURE"
        title="Reports"
        description="Revenue, cost of goods sold, expenses, and profit from completed payments."
      >
        <select
          aria-label="Report date range"
          value={range}
          onChange={(e) => setRange(e.target.value)}
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
        )}{' '}
        {range === 'custom' && (
          <>
            <input
              aria-label="From date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              aria-label="To date"
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}
        <ExcelButton onExport={() => prepareExcel('report-' + start + '-to-' + end, exportRows)} />
      </PageHeader>
      {range === 'custom' && from > to && (
        <p className="form-error" role="alert">
          The end date must be on or after the start date.
        </p>
      )}
      {(workspace.storageError || requests.error) && (
        <p role="alert" className="form-error">
          {workspace.storageError || requests.error}
        </p>
      )}
      <div className="report-highlight">
        <div>
          <span className="eyebrow">NET PROFIT BEFORE TAX</span>
          <strong>{formatPHP(summary.profit)}</strong>
          <small>
            {summary.revenue ? ((summary.profit / summary.revenue) * 100).toFixed(1) : '0.0'}%
            margin · {summary.sales.length} recorded sales
          </small>
        </div>
        <dl className="admin-report-metrics">
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
        <BarChart3
          className="admin-report-watermark"
          size={54}
          strokeWidth={1.2}
          aria-hidden="true"
        />
      </div>
      <div className="reports-grid">
        <Panel
          title="Service activity"
          subtitle="Current status of jobs with target dates in this period"
        >
          <div className="report-rows">
            {['Checked in', 'In service', 'Ready for checkout', 'Completed'].map((status) => (
              <div key={status}>
                <span>{status}</span>
                <strong>
                  {serviceJobs.filter((job) => serviceState(job.status) === status).length}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="PC build activity"
          subtitle="Current status of requests created in this period"
        >
          <div className="report-rows">
            {[...new Set(buildRequests.map((request) => request.status))].map((status) => (
              <div key={status}>
                <span>{status}</span>
                <strong>
                  {buildRequests.filter((request) => request.status === status).length}
                </strong>
              </div>
            ))}
            {!buildRequests.length && <p>No build requests created in this period.</p>}
          </div>
        </Panel>
        <Panel title="Inventory movements" subtitle="Ledger movements in the selected period">
          {movements.error ? (
            <p role="alert" className="form-error">
              {movements.error}
            </p>
          ) : movements.loading ? (
            <p role="status">Loading movements...</p>
          ) : (
            <div className="report-rows">
              {[...new Set(movements.rows.map((movement) => movement.type))].map((type) => (
                <div key={type}>
                  <span>{type.replaceAll('_', ' ')}</span>
                  <strong>
                    {movements.rows.filter((movement) => movement.type === type).length} movements
                  </strong>
                </div>
              ))}
              {!movements.rows.length && <p>No stock movements in this period.</p>}
            </div>
          )}
        </Panel>
        <Panel
          title="Current stock attention"
          subtitle="Live availability, independent of the report dates"
        >
          <p>{lowStock.length} items at or below minimum stock.</p>
          <Link className="secondary-button" to="/inventory?filter=low">
            Review low stock
          </Link>
        </Panel>
      </div>
      <div className="reports-grid">
        <Panel title="Profit summary" subtitle="Revenue less recorded costs">
          <div className="report-rows">
            <div>
              <span>Revenue excluding sales tax</span>
              <b>{formatPHP(summary.revenue)}</b>
            </div>
            <div>
              <span>Cost of sales</span>
              <b>− {formatPHP(summary.cost)}</b>
            </div>
            <div>
              <span>Operating expenses</span>
              <b>− {formatPHP(summary.spent)}</b>
            </div>
            <div className="report-total">
              <span>Net profit</span>
              <strong>{formatPHP(summary.profit)}</strong>
            </div>
          </div>
        </Panel>
        <Panel title="Payment collection" subtitle="Payments against sales in this period">
          <div className="report-rows">
            <div>
              <span>Sales total</span>
              <b>{formatPHP(summary.salesTotal)}</b>
            </div>
            <div>
              <span>Payments received</span>
              <b>{formatPHP(summary.received)}</b>
            </div>
            <div>
              <span>Paid transactions</span>
              <b>{summary.sales.length}</b>
            </div>
            <div>
              <span>Sales tax on invoices</span>
              <b>{formatPHP(summary.taxCollected)}</b>
            </div>
            <div className="report-total">
              <span>Gross profit</span>
              <strong>{formatPHP(summary.revenue - summary.cost)}</strong>
            </div>
          </div>
        </Panel>
      </div>
      <div className="reports-grid">
        {[
          [
            'Payment methods',
            [...new Set(summary.sales.map((sale) => sale.paymentMethod ?? 'Not recorded'))],
          ],
          ['Sales by channel', ['Walk-in', 'Online']],
        ].map(([title, values]) => (
          <Panel key={String(title)} title={String(title)}>
            <div className="report-rows">
              {(values as string[]).map((value) => (
                <div key={value}>
                  <span>{value}</span>
                  <strong>
                    {formatPHP(
                      summary.sales
                        .filter((sale) =>
                          title === 'Payment methods'
                            ? (sale.paymentMethod ?? 'Not recorded') === value
                            : (sale.channel ?? 'Walk-in') === value,
                        )
                        .reduce((sum, sale) => sum + sale.total, 0),
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <div className="reports-grid">
        <Panel
          title="Item sales by category"
          subtitle="Line subtotals before invoice discounts, fees, and tax"
        >
          <div className="report-rows">
            {[...itemCategories]
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => (
                <div key={category}>
                  <span>{category}</span>
                  <strong>{formatPHP(amount)}</strong>
                </div>
              ))}
            {!itemCategories.size && <p>No item sales in this period.</p>}
          </div>
        </Panel>
        <Panel title="Daily paid sales" subtitle="Invoice totals on payment dates">
          <div className="analytics-rows">
            {[...dailySales]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, amount]) => (
                <div key={date}>
                  <span>{date}</span>
                  <strong>{formatPHP(amount)}</strong>
                  <meter
                    aria-label={'Paid sales on ' + date}
                    min={0}
                    max={Math.max(1, ...dailySales.values())}
                    value={amount}
                  />
                </div>
              ))}
            {!dailySales.size && <p>No paid sales in this period.</p>}
          </div>
        </Panel>
      </div>
      <Panel title="Expense breakdown" subtitle="Where operating spend is going">
        <div className="expense-summary">
          <span>Operating expenses</span>
          <strong>{formatPHP(summary.spent)}</strong>
          <small>
            {summary.expenses.length} entries / {categoryTotals.size} categories
          </small>
        </div>
        <div className="expense-breakdown">
          {[...categoryTotals]
            .sort((a, b) => b[1] - a[1])
            .map(([category, amount]) => (
              <div key={category}>
                <div>
                  <span>{category}</span>
                  <strong>
                    {formatPHP(amount)}{' '}
                    <small>
                      {summary.spent ? ((amount / summary.spent) * 100).toFixed(1) : '0'}%
                    </small>
                  </strong>
                </div>
                <progress
                  aria-label={category + ' share of expenses'}
                  value={amount}
                  max={summary.spent || 1}
                />
              </div>
            ))}
          {!summary.expenses.length && <p>No expenses recorded in this period.</p>}
        </div>
      </Panel>
    </>
  )
}
