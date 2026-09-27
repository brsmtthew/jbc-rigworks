import { ArrowRight, CalendarDays, Cpu, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { RecordStatus } from './RecordStatus'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { formatPHP } from '../../lib/format'
import { useCustomerRequests } from './useCustomerRequests'

export function CustomerHomePage() {
  const { user } = useAuth()
  const { sales, loading, storageError } = useWorkspace()
  const { appointments, requests, error, loading: requestsLoading } = useCustomerRequests(user)
  const active = appointments
    .filter((item) => !['Completed', 'Cancelled', 'No show'].includes(item.status))
    .sort((a, b) =>
      (a.preferredDate + a.preferredTime).localeCompare(b.preferredDate + b.preferredTime),
    )
  const next = active[0]
  const recentOrders = [...sales]
    .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
    .slice(0, 3)
  const ready = !loading && !requestsLoading && !error && !storageError
  return (
    <>
      <PageHeader
        eyebrow="YOUR JBC WORKSPACE"
        title={`Hello, ${user?.name.split(' ')[0] || 'there'}.`}
        description="A little care. A better-performing PC."
      />
      <section className="customer-welcome">
        <div>
          <h2>What can we help you with?</h2>
          <p>Care for your device or plan what comes next.</p>
        </div>
        <div className="quick-actions">
          <Link className="primary-button" to="/customer/services">
            <CalendarDays size={18} />
            Book a service
          </Link>
          <Link className="secondary-button" to="/customer/pc-building">
            <Cpu size={18} />
            Build a PC
          </Link>
          <Link className="text-button" to="/customer/shop">
            Shop parts
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      {(error || storageError) && (
        <p className="form-error" role="alert">
          {error || storageError}
        </p>
      )}
      {!ready && !error && !storageError && <LoadingState label="Loading your activity…" />}
      {ready && (
        <>
          <div className="customer-stats">
            <Link to="/customer/records?tab=appointments">
              <CalendarDays />
              <span>
                Active appointments<strong>{active.length}</strong>
                <small>{appointments.length} in your history</small>
              </span>
              <ArrowRight size={18} />
            </Link>
            <Link to="/customer/records?tab=requests">
              <Cpu />
              <span>
                PC requests<strong>{requests.length}</strong>
                <small>Review quotes and progress</small>
              </span>
              <ArrowRight size={18} />
            </Link>
            <Link to="/customer/records?tab=orders">
              <ShoppingBag />
              <span>
                Orders<strong>{sales.length}</strong>
                <small>Purchases and warranties</small>
              </span>
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="customer-dashboard-grid">
            <Panel
              title="Your next appointment"
              subtitle="Requests become appointments when JBC confirms"
            >
              {next ? (
                <div className="next-appointment">
                  <RecordStatus status={next.status} />
                  <h3>{next.service}</h3>
                  <p>{next.device}</p>
                  <dl className="customer-detail-grid">
                    <div>
                      <dt>Preferred schedule</dt>
                      <dd>
                        {next.preferredDate}
                        <br />
                        {next.preferredTime}
                      </dd>
                    </div>
                    <div>
                      <dt>Service location</dt>
                      <dd>{next.visit?.mode || 'See request details'}</dd>
                    </div>
                  </dl>
                  <p>
                    {next.status === 'Requested'
                      ? 'Waiting for JBC to review and confirm your time.'
                      : 'View your appointment for its latest details.'}
                  </p>
                  <Link
                    className="secondary-button"
                    to={`/customer/records?tab=appointments&reference=${encodeURIComponent(next.id)}`}
                  >
                    View appointment
                    <ArrowRight size={17} />
                  </Link>
                </div>
              ) : (
                <div className="customer-empty">
                  <CalendarDays />
                  <p>No active appointments. Book a service when your device needs care.</p>
                  <Link to="/customer/services">Find a service</Link>
                </div>
              )}
            </Panel>
            <Panel
              title="PC requests"
              action={<Link to="/customer/records?tab=requests">View all</Link>}
            >
              {requests.length ? (
                <div className="customer-record-list">
                  {requests.slice(0, 3).map((item) => (
                    <div key={item.id}>
                      <span>
                        <strong>{item.useCase} PC</strong>
                        <small>{item.id}</small>
                      </span>
                      <RecordStatus status={item.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="customer-empty">
                  <Cpu />
                  <p>Start with a build idea. Save your parts and request a quote.</p>
                  <Link to="/customer/pc-building">Open PC Builder</Link>
                </div>
              )}
            </Panel>
          </div>
          <Panel
            title="Recent orders"
            action={<Link to="/customer/records?tab=orders">View all orders</Link>}
          >
            {recentOrders.length ? (
              <div className="customer-record-list">
                {recentOrders.map((order) => (
                  <div key={order.id}>
                    <span>
                      <strong>{order.detail}</strong>
                      <small>
                        {order.date} · {formatPHP(order.total)}
                      </small>
                    </span>
                    <RecordStatus status={order.orderStatus ?? order.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="customer-empty">
                <ShoppingBag />
                <p>Your purchases will appear here.</p>
                <Link to="/customer/shop">Browse parts</Link>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  )
}
