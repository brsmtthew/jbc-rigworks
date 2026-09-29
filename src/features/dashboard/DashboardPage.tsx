import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Coins,
  Cpu,
  Package,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PeriodSelect } from '../../components/ui/Filters'
import { MetricCard } from '../../components/ui/MetricCard'
import { Panel } from '../../components/ui/Panel'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { currentPeriod } from '../../lib/dates'
import { formatPHP } from '../../lib/format'
import { availableStock, serviceState } from '../../lib/workflow'
import { useAllRequests } from '../customer/useCustomerRequests'
import { getSummary } from '../finance/summary'
import { usePaymentProofs } from '../finance/usePayments'
import { RevenueChart } from './RevenueChart'

export function DashboardPage() {
  const workspace = useWorkspace()
  const { user } = useAuth()
  const requests = useAllRequests(true),
    proofs = usePaymentProofs(user)
  const [params, setParams] = useSearchParams()
  const requested = params.get('period') ?? currentPeriod()
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentPeriod()
  const summary = getSummary(period, workspace)
  const jobCounts = ['Checked in', 'In service', 'Ready for checkout', 'Completed'].map(
    (label) => ({
      label,
      value: workspace.jobs.filter((job) => serviceState(job.status) === label).length,
    }),
  )
  const low = workspace.inventory.filter(
    (item) => item.active !== false && availableStock(item) <= item.minimum,
  ).length
  const channels = ['Walk-in', 'Online'].map((label) => ({
    label,
    value: summary.sales
      .filter((sale) => (sale.channel ?? 'Walk-in') === label)
      .reduce((sum, sale) => sum + sale.total, 0),
  }))
  const channelTotal = channels.reduce((sum, channel) => sum + channel.value, 0)
  const walkInShare = channelTotal ? (channels[0].value / channelTotal) * 100 : 0
  const activeInventory = workspace.inventory.filter((item) => item.active !== false)
  const outOfStock = activeInventory.filter((item) => availableStock(item) === 0).length
  const healthyStock = activeInventory.filter((item) => availableStock(item) > item.minimum).length
  return (
    <div className="admin-dashboard">
      <section className="admin-dashboard-hero jbc-blue-hero" aria-labelledby="admin-dashboard-title">
        <div className="admin-dashboard-hero-copy">
          <div>
            <span className="admin-dashboard-hero-kicker">WORKSHOP ANALYTICS</span>
            <h1 id="admin-dashboard-title">Dashboard</h1>
            <p>Sales, profitability, stock, and service activity in one place.</p>
          </div>
        </div>
        <div className="admin-dashboard-period">
          <div className="admin-dashboard-period-label">
            <CalendarDays size={17} aria-hidden="true" />
            <span>REPORTING MONTH</span>
          </div>
          <PeriodSelect value={period} onChange={(value) => setParams({ period: value })} />
          <small>{summary.sales.length} {summary.sales.length === 1 ? 'sale' : 'sales'} recorded</small>
        </div>
      </section>
      <div className="metric-grid">
        <MetricCard
          label="Revenue"
          value={formatPHP(summary.revenue, true)}
          note={summary.sales.length + ' sales this period'}
          icon={TrendingUp}
        />
        <MetricCard
          label="Payments received"
          value={formatPHP(summary.received, true)}
          note="Against selected sales"
          icon={Coins}
        />
        <MetricCard
          label="Operating expenses"
          value={formatPHP(summary.spent, true)}
          note="Excludes voided expenses"
          icon={BriefcaseBusiness}
        />
        <MetricCard
          label="Net profit"
          value={formatPHP(summary.profit, true)}
          note="After recorded costs, before tax"
          icon={TrendingUp}
          dark
        />
      </div>
      <section className="admin-attention" aria-labelledby="attention-title">
        <div className="admin-section-heading">
          <div>
            <span className="eyebrow">YOUR WORK QUEUE</span>
            <h2 id="attention-title">Needs your attention</h2>
          </div>
          <span>Choose a queue to get started</span>
        </div>
        <div className="admin-queue-grid">
          {[
            {
              label: 'Service requests',
              count: requests.appointments.filter((item) => item.status === 'Requested').length,
              to: '/jobs?tab=requests',
              icon: Wrench,
            },
            {
              label: 'Quotes to review',
              count: requests.requests.filter((item) =>
                ['Quote requested', 'Under review'].includes(item.status),
              ).length,
              to: '/pc-building',
              icon: Cpu,
            },
            { label: 'Low-stock items', count: low, to: '/inventory?filter=low', icon: Package },
            {
              label: 'Payments to verify',
              count: proofs.rows.filter((item) => item.status === 'Pending').length,
              to: '/pos?orders=true',
              icon: Coins,
            },
          ].map(({ label, count, to, icon: Icon }) => (
            <Link key={label} to={to} className="admin-queue-item">
              <Icon size={20} />
              <span>
                <strong>{count}</strong>
                <small>{label}</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      </section>
      <div className="analytics-grid">
        <Panel
          title="Sales & collections"
          subtitle="Daily sales and collections for the selected month"
          className="chart-panel"
          action={
            <div className="chart-legend">
              <span>
                <i className="legend-blue" />
                Sales
              </span>
              <span>
                <i className="legend-teal" />
                Collections
              </span>
            </div>
          }
        >
          <RevenueChart sales={summary.sales} period={period} />
        </Panel>
        <Panel
          title="Service activity"
          subtitle="Current job stages"
          className="service-chart-panel"
        >
          <div className="service-chart-summary">
            <strong>{workspace.jobs.length}</strong>
            <span>jobs in your workspace</span>
          </div>
          <div className="service-chart-bars">
            {jobCounts.map((row) => (
              <div className="service-chart-row" key={row.label}>
                <div>
                  <Link
                    to={
                      '/jobs?tab=' +
                      (row.label === 'Completed' ? 'completed' : 'active') +
                      '&status=' +
                      encodeURIComponent(row.label)
                    }
                  >
                    {row.label}
                  </Link>
                  <strong>{row.value}</strong>
                </div>
                <div
                  className="service-chart-track"
                  role="img"
                  aria-label={`${row.value} of ${workspace.jobs.length} jobs ${row.label.toLowerCase()}`}
                >
                  <span
                    style={{
                      width: `${workspace.jobs.length ? (row.value / workspace.jobs.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Sales by channel"
          subtitle="Invoice totals, including tax"
          className="channel-chart-panel"
        >
          <div className="channel-chart-layout">
            <div
              className={`channel-donut ${channelTotal ? '' : 'channel-donut-empty'}`}
              style={{ '--channel-share': `${walkInShare}%` } as CSSProperties}
              role="img"
              aria-label={
                channelTotal
                  ? `Walk-in ${Math.round(walkInShare)} percent, online ${Math.round(100 - walkInShare)} percent`
                  : 'No sales recorded this month'
              }
            >
              <div className="channel-donut-center">
                <span>Total sales</span>
                <strong>{formatPHP(channelTotal, true)}</strong>
              </div>
            </div>
            <div className="channel-legend">
              {channels.map((row, index) => (
                <div key={row.label}>
                  <span className={`channel-swatch channel-swatch-${index}`} aria-hidden="true" />
                  <div>
                    <span>{row.label}</span>
                    <strong>{formatPHP(row.value)}</strong>
                  </div>
                  <small>{channelTotal ? Math.round((row.value / channelTotal) * 100) : 0}%</small>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel
          title="Inventory health"
          subtitle="Current stock across all categories"
          className="inventory-chart-panel"
        >
          <div
            className="inventory-health-visual"
            role="img"
            aria-label={`${healthyStock} healthy stock items, ${Math.max(0, low - outOfStock)} low stock items, ${outOfStock} out of stock items`}
          >
            <span
              style={{
                width: `${activeInventory.length ? (healthyStock / activeInventory.length) * 100 : 0}%`,
              }}
            />
            <span
              style={{
                width: `${activeInventory.length ? (Math.max(0, low - outOfStock) / activeInventory.length) * 100 : 0}%`,
              }}
            />
            <span
              style={{
                width: `${activeInventory.length ? (outOfStock / activeInventory.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="inventory-health-key">
            <span>Healthy</span>
            <span>Low</span>
            <span>Out</span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Stock value at cost</dt>
              <dd>
                {formatPHP(
                  workspace.inventory.reduce((sum, item) => sum + item.stock * item.cost, 0),
                )}
              </dd>
            </div>
            <div>
              <dt>Unique items</dt>
              <dd>{workspace.inventory.length}</dd>
            </div>
            <div>
              <dt>Low-stock items</dt>
              <dd>{low}</dd>
            </div>
            <div>
              <dt>Out of stock</dt>
              <dd>{outOfStock}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  )
}
