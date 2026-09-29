import { CalendarDays, Clock3, Cpu, MapPin, ShoppingBag } from 'lucide-react'
import { LoadingState } from '../../components/ui/LoadingState'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { formatPHP } from '../../lib/format'
import { RecordStatus } from './RecordStatus'
import { useCustomerRequests } from './useCustomerRequests'

export function CustomerHomePage() {
  const { user } = useAuth()
  const { sales, loading, storageError } = useWorkspace()
  const { appointments, requests, error, loading: requestsLoading } = useCustomerRequests(user)
  const firstName = user?.name.trim().split(/\s+/)[0] || 'there'
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
    <div className="customer-home">
      <header className="customer-home-hero jbc-blue-hero">
        <div className="customer-home-hero-copy">
          <span className="customer-home-kicker">YOUR JBC WORKSPACE</span>
          <h1>Hello, {firstName}.</h1>
          <p>Your service activity, PC requests, and orders in one place.</p>
        </div>
        <div className="customer-home-hero-art" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </header>

      {(error || storageError) && (
        <p className="form-error" role="alert">
          {error || storageError}
        </p>
      )}
      {!ready && !error && !storageError && <LoadingState label="Loading your activity…" />}

      {ready && (
        <>
          <section className="customer-home-overview" aria-labelledby="customer-overview-title">
            <div className="customer-home-section-heading">
              <div>
                <span className="customer-home-kicker">ACCOUNT OVERVIEW</span>
                <h2 id="customer-overview-title">At a glance</h2>
              </div>
              <p>Your current activity with JBC RigWorks</p>
            </div>
            <div className="customer-home-metrics">
              <article className="customer-home-metric">
                <div className="customer-home-metric-icon">
                  <CalendarDays size={21} aria-hidden="true" />
                </div>
                <div>
                  <span>Active appointments</span>
                  <strong>{active.length}</strong>
                  <small>{appointments.length} total in your history</small>
                </div>
              </article>
              <article className="customer-home-metric">
                <div className="customer-home-metric-icon">
                  <Cpu size={21} aria-hidden="true" />
                </div>
                <div>
                  <span>PC requests</span>
                  <strong>{requests.length}</strong>
                  <small>Build ideas and quotes</small>
                </div>
              </article>
              <article className="customer-home-metric">
                <div className="customer-home-metric-icon">
                  <ShoppingBag size={21} aria-hidden="true" />
                </div>
                <div>
                  <span>Orders</span>
                  <strong>{sales.length}</strong>
                  <small>Purchases on record</small>
                </div>
              </article>
            </div>
          </section>

          <section className="customer-home-activity" aria-labelledby="customer-activity-title">
            <div className="customer-home-section-heading">
              <div>
                <span className="customer-home-kicker">LATEST ACTIVITY</span>
                <h2 id="customer-activity-title">Your activity</h2>
              </div>
              <p>Details are available in My records</p>
            </div>
            <div className="customer-home-grid">
              <section
                className="customer-home-card customer-home-appointment"
                aria-labelledby="customer-next-title"
              >
                <div className="customer-home-card-heading">
                  <span className="customer-home-card-icon">
                    <CalendarDays size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <span className="customer-home-card-kicker">SERVICE</span>
                    <h3 id="customer-next-title">Next appointment</h3>
                  </div>
                </div>
                {next ? (
                  <div className="customer-home-appointment-content">
                    <div className="customer-home-appointment-title">
                      <div>
                        <h4>{next.service}</h4>
                        <p>{next.device}</p>
                      </div>
                      <RecordStatus status={next.status} />
                    </div>
                    <div className="customer-home-appointment-facts">
                      <div>
                        <Clock3 size={18} aria-hidden="true" />
                        <span>
                          <small>Preferred schedule</small>
                          <strong>{next.preferredDate}</strong>
                          <span>{next.preferredTime}</span>
                        </span>
                      </div>
                      <div>
                        <MapPin size={18} aria-hidden="true" />
                        <span>
                          <small>Service location</small>
                          <strong>{next.visit?.mode || 'See request details'}</strong>
                        </span>
                      </div>
                    </div>
                    <p className="customer-home-context">
                      {next.status === 'Requested'
                        ? 'JBC will review your request and confirm the schedule.'
                        : 'Check My records for the latest appointment details.'}
                    </p>
                  </div>
                ) : (
                  <div className="customer-home-empty">
                    <CalendarDays size={26} aria-hidden="true" />
                    <p>No active appointments right now.</p>
                    <small>Service bookings will appear here.</small>
                  </div>
                )}
              </section>

              <section className="customer-home-card" aria-labelledby="customer-requests-title">
                <div className="customer-home-card-heading">
                  <span className="customer-home-card-icon">
                    <Cpu size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <span className="customer-home-card-kicker">BUILDS</span>
                    <h3 id="customer-requests-title">PC requests</h3>
                  </div>
                </div>
                {requests.length ? (
                  <div className="customer-home-list">
                    {requests.slice(0, 3).map((item) => (
                      <div className="customer-home-list-item" key={item.id}>
                        <div>
                          <strong>{item.useCase} PC</strong>
                          <small>{item.id}</small>
                        </div>
                        <RecordStatus status={item.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="customer-home-empty">
                    <Cpu size={26} aria-hidden="true" />
                    <p>No PC requests yet.</p>
                    <small>Your build requests and quotes will appear here.</small>
                  </div>
                )}
              </section>
            </div>

            <section
              className="customer-home-card customer-home-orders"
              aria-labelledby="customer-orders-title"
            >
              <div className="customer-home-card-heading">
                <span className="customer-home-card-icon">
                  <ShoppingBag size={20} aria-hidden="true" />
                </span>
                <div>
                  <span className="customer-home-card-kicker">PURCHASES</span>
                  <h3 id="customer-orders-title">Recent orders</h3>
                </div>
              </div>
              {recentOrders.length ? (
                <div className="customer-home-list">
                  {recentOrders.map((order) => (
                    <div className="customer-home-list-item" key={order.id}>
                      <div>
                        <strong>{order.detail}</strong>
                        <small>
                          {order.date} · {formatPHP(order.total)}
                        </small>
                      </div>
                      <RecordStatus status={order.orderStatus ?? order.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="customer-home-empty">
                  <ShoppingBag size={26} aria-hidden="true" />
                  <p>No orders yet.</p>
                  <small>Your purchases will appear here.</small>
                </div>
              )}
            </section>
          </section>
        </>
      )}
    </div>
  )
}
