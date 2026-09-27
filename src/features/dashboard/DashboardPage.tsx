import {
  ArrowUpRight,
  BriefcaseBusiness,
  Coins,
  Cpu,
  Package,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PeriodSelect } from '../../components/ui/Filters'
import { MetricCard } from '../../components/ui/MetricCard'
import { PageHeader } from '../../components/ui/PageHeader'
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
  return (
    <>
      <PageHeader
        eyebrow="WORKSHOP ANALYTICS"
        title="Dashboard"
        description="Sales, profitability, stock, and service activity."
      >
        <PeriodSelect value={period} onChange={(value) => setParams({ period: value })} />
      </PageHeader>
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
          subtitle="Daily totals for every calendar day in the selected month"
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
        <Panel title="Service activity" subtitle="All current jobs">
          <div className="analytics-rows">
            {jobCounts.map((row) => (
              <div key={row.label}>
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
                <meter
                  min={0}
                  max={Math.max(1, workspace.jobs.length)}
                  value={row.value}
                  aria-label={row.label}
                />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Sales by channel" subtitle="Invoice totals, including tax">
          <div className="analytics-rows">
            {channels.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{formatPHP(row.value)}</strong>
                <meter
                  min={0}
                  max={Math.max(1, ...channels.map((row) => row.value))}
                  value={row.value}
                  aria-label={row.label}
                />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Inventory health" subtitle="Current stock across all categories">
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
              <dd>
                {
                  workspace.inventory.filter(
                    (item) => item.active !== false && availableStock(item) === 0,
                  ).length
                }
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </>
  )
}
