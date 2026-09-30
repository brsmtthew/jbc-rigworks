import { ClipboardList, FileText, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../components/ui/LoadingState'
import { SearchField } from '../../components/ui/Filters'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { formatDate, formatPHP } from '../../lib/format'
import { humanError, serviceState } from '../../lib/workflow'
import type { Job, ServiceStatus } from '../../types'
import { RecordStatus } from '../customer/RecordStatus'
import { RequestQueue } from './RequestQueue'
import { ServiceIntake } from './ServiceIntake'
import { WalkInIntakeReview } from './WalkInIntakeReview'
import { advanceService } from './serviceOperations'

export function ServiceWorkspace({ onCreate }: { onCreate: () => void }) {
  const [params] = useSearchParams()
  return <ServiceWorkspaceContent key={params.get('reference') ?? ''} onCreate={onCreate} />
}

function ServiceWorkspaceContent({ onCreate }: { onCreate: () => void }) {
  const { jobs, loading, storageError } = useWorkspace(),
    { user } = useAuth(),
    navigate = useNavigate()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') ?? 'requests'),
    [query, setQuery] = useState(params.get('reference') ?? '')
  const [editing, setEditing] = useState<Job | null>(null),
    [reviewingWalkIn, setReviewingWalkIn] = useState<Job | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState(params.get('status') ?? 'all')
  const filtered = jobs.filter(
    (job) =>
      (tab === 'completed'
        ? serviceState(job.status) === 'Completed'
        : serviceState(job.status) !== 'Completed') &&
      (statusFilter === 'all' || serviceState(job.status) === statusFilter) &&
      `${job.customer} ${job.device} ${job.service}`.toLowerCase().includes(query.toLowerCase()),
  )

  async function advance(job: Job, next: ServiceStatus) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await advanceService(user!, job.id, next)
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }

  if (storageError) return <p role="alert" className="form-error">{storageError}</p>
  if (loading) return <LoadingState variant="table" label="Loading service jobs…" />

  return (
    <div className="admin-services">
      <section className="admin-services-hero jbc-blue-hero" aria-labelledby="admin-services-title">
        <div className="admin-services-hero-copy">
          <div>
            <span className="eyebrow">WORKSHOP OPERATIONS</span>
            <h1 id="admin-services-title">Services</h1>
            <p>Review appointments, care for devices, and prepare them for checkout.</p>
          </div>
        </div>
        <div className="admin-services-hero-side">
          <span className="admin-services-hero-side-label">SERVICE ACTIVITY</span>
          <span className="admin-services-hero-count">
            <strong>{jobs.length}</strong>
            <span>service {jobs.length === 1 ? 'job' : 'jobs'} recorded</span>
          </span>
          <button type="button" className="primary-button" onClick={onCreate}>
            <Plus size={17} /> Add walk-in service
          </button>
        </div>
      </section>

      <div className="admin-services-controls">
        <div className="record-tabs admin-services-tabs" role="group" aria-label="Services">
          {[
            ['requests', 'Requests / appointments'],
            ['active', 'Active jobs'],
            ['completed', 'Completed'],
          ].map(([id, label]) => (
            <button
              type="button"
              aria-pressed={tab === id}
              className={tab === id ? 'primary-button' : 'secondary-button'}
              key={id}
              onClick={() => {
                setTab(id)
                setQuery('')
                setStatusFilter('all')
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="admin-filter-bar admin-services-filters">
          <SearchField
            label={tab === 'requests' ? 'Search appointments' : 'Search services'}
            value={query}
            onChange={setQuery}
          />
          {tab === 'active' && (
            <label className="admin-filter-label">
              <span className="sr-only">Service status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All active statuses</option>
                {['Checked in', 'In service', 'Ready for checkout'].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {tab === 'requests' ? (
        <RequestQueue query={query} />
      ) : (
        <section
          className="admin-services-list"
          aria-label={tab === 'completed' ? 'Completed service jobs' : 'Active service jobs'}
        >
          <div className="admin-services-list-heading">
            <div>
              <span className="eyebrow">SERVICE RECORDS</span>
              <h2>{tab === 'completed' ? 'Completed jobs' : 'Jobs in progress'}</h2>
            </div>
            <span className="result-count" role="status">
              {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
            </span>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {filtered.length ? (
            <div className="service-record-list">
              {filtered.map((job) => {
                const status = serviceState(job.status)
                return (
                  <article className="service-record-row" key={job.id}>
                    <div className="service-record-main">
                      <div className="service-record-heading">
                        <span className="service-record-icon" aria-hidden="true">
                          <ClipboardList size={20} />
                        </span>
                        <div className="service-record-title">
                          <h3>{job.service}</h3>
                          <span>{job.device}</span>
                        </div>
                        {job.channel === 'Walk-in' && (
                          <span className="service-record-channel">Walk-in</span>
                        )}
                        <RecordStatus status={status} />
                      </div>
                      <dl className="service-record-values">
                        <div>
                          <dt>Customer</dt>
                          <dd>{job.customer}<small>{job.contact || 'No contact recorded'}</small></dd>
                        </div>
                        <div>
                          <dt>Target date</dt>
                          <dd>{job.due ? formatDate(job.due) : 'Not scheduled'}</dd>
                        </div>
                        <div>
                          <dt>Estimate</dt>
                          <dd>{job.quote > 0 ? formatPHP(job.quote) : 'Pending review'}</dd>
                        </div>
                        <div>
                          <dt>Payment</dt>
                          <dd>{job.paymentStatus ?? 'Unpaid'}</dd>
                        </div>
                      </dl>
                      {job.concern && (
                        <p className="service-record-note">
                          <strong>Customer concern</strong> {job.concern}
                        </p>
                      )}
                    </div>
                    <div
                      className="service-record-actions"
                      role="group"
                      aria-label={`Actions for ${job.service}, ${job.customer}`}
                    >
                      <span className="service-record-actions-label">Actions</span>
                      {job.channel === 'Walk-in' && job.serviceIntake && (
                        <button
                          type="button"
                          className="customer-record-action"
                          aria-label="Review / print intake"
                          onClick={() => setReviewingWalkIn(job)}
                        >
                          <FileText size={16} /> Intake form
                        </button>
                      )}
                      {status !== 'Completed' && job.paymentStatus !== 'Paid' && (
                        <button
                          type="button"
                          className="customer-record-action"
                          aria-label="Review intake & quote"
                          onClick={() => setEditing(job)}
                        >
                          <Pencil size={16} /> {job.channel === 'Walk-in' ? 'Edit quote' : 'Edit job'}
                        </button>
                      )}
                      {status === 'Checked in' && (
                        <button
                          type="button"
                          className="customer-record-action is-primary"
                          title={job.channel === 'Walk-in' && !job.intakeSignedAt ? 'Record the signed intake before starting service' : undefined}
                          disabled={busy || (job.channel === 'Walk-in' && !job.intakeSignedAt)}
                          onClick={() => advance(job, 'In service')}
                        >
                          Start service
                        </button>
                      )}
                      {status === 'In service' && (
                        <button
                          disabled={busy}
                          type="button"
                          className="customer-record-action is-primary"
                          aria-label="Mark ready for checkout"
                          onClick={() => advance(job, 'Ready for checkout')}
                        >
                          Mark ready
                        </button>
                      )}
                      {status === 'Ready for checkout' &&
                        (job.paymentStatus === 'Paid' ? (
                          <button
                            disabled={busy}
                            type="button"
                            className="customer-record-action is-primary"
                            aria-label="Release device & complete"
                            onClick={() => advance(job, 'Completed')}
                          >
                            Complete
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="customer-record-action is-primary"
                            aria-label="Collect payment in POS"
                            onClick={() =>
                              navigate('/pos', {
                                state: job.transactionId
                                  ? { collectSaleId: job.transactionId }
                                  : { job },
                              })
                            }
                          >
                            POS payment
                          </button>
                        ))}
                      {job.channel === 'Walk-in' &&
                        job.paymentStatus !== 'Paid' &&
                        job.quote > 0 &&
                        (status === 'Checked in' || status === 'In service') && (
                          <button
                            type="button"
                            className="customer-record-action is-primary"
                            aria-label="Pay now in POS"
                            onClick={() => navigate('/pos', { state: { job } })}
                          >
                            Pay in POS
                          </button>
                        )}
                      {status === 'Completed' && (
                        <span className="service-record-closed">Service complete</span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No services in this view</h3>
              <p>
                {query || statusFilter !== 'all'
                  ? 'Try another search or status.'
                  : 'Checked-in appointments and saved walk-in intakes appear here.'}
              </p>
            </div>
          )}
        </section>
      )}
      {editing && <ServiceIntake job={editing} onClose={() => setEditing(null)} />}
      {reviewingWalkIn && (
        <WalkInIntakeReview job={reviewingWalkIn} onClose={() => setReviewingWalkIn(null)} />
      )}
    </div>
  )
}
