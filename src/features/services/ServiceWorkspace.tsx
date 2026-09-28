import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingState } from '../../components/ui/LoadingState'
import { SearchField } from '../../components/ui/Filters'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { formatPHP } from '../../lib/format'
import { humanError, serviceState } from '../../lib/workflow'
import type { Job, ServiceStatus } from '../../types'
import { RequestQueue } from './RequestQueue'
import { ServiceIntake } from './ServiceIntake'
import { advanceService } from './serviceOperations'

export function ServiceWorkspace({ onCreate }: { onCreate: () => void }) {
  const { jobs, loading, storageError } = useWorkspace(),
    { user } = useAuth(),
    navigate = useNavigate()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') ?? 'requests'),
    [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Job | null>(null),
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
    <>
      <PageHeader
        eyebrow="WORKSHOP"
        title="Services"
        description="Confirm appointments, care for devices, then collect payment through POS."
      >
        <button className="primary-button" onClick={onCreate}>
          New service job
        </button>
      </PageHeader>
      <div className="record-tabs" role="group" aria-label="Services">
        {[
          ['requests', 'Requests / appointments'],
          ['active', 'Active jobs'],
          ['completed', 'Completed'],
        ].map(([id, label]) => (
          <button
            aria-pressed={tab === id}
            className={tab === id ? 'primary-button' : 'secondary-button'}
            key={id}
            onClick={() => {
              setTab(id)
              setStatusFilter('all')
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'requests' ? (
        <RequestQueue />
      ) : (
        <>
          <div className="admin-filter-bar">
            <SearchField label="Search services" value={query} onChange={setQuery} />
            {tab === 'active' && (
              <label className="admin-filter-label">
                Service status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All active statuses</option>
                  {['Checked in', 'In service', 'Ready for checkout'].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            )}
            <span className="result-count" role="status">
              {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
            </span>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="jobs-grid">
            {filtered.map((job) => {
              const status = serviceState(job.status)
              return (
                <article className="job-card" key={job.id}>
                  <span className="eyebrow">
                    {status} · {job.paymentStatus ?? 'Unpaid'}
                  </span>
                  <h2>{job.service}</h2>
                  <p>{job.device}</p>
                  <p>
                    {job.customer} · {job.contact}
                  </p>
                  <p>{job.concern}</p>
                  <p>
                    Target {job.due} ·{' '}
                    {job.quote > 0
                      ? 'Price before tax ' + formatPHP(job.quote)
                      : 'Quote pending review'}
                  </p>
                  <div className="job-card-actions">
                    {status !== 'Completed' && job.paymentStatus !== 'Paid' && (
                      <button className="secondary-button" onClick={() => setEditing(job)}>
                        Review intake & quote
                      </button>
                    )}
                    {status === 'Checked in' && (
                      <button
                        disabled={busy}
                        className="primary-button"
                        onClick={() => advance(job, 'In service')}
                      >
                        Start service
                      </button>
                    )}
                    {status === 'In service' && (
                      <button
                        disabled={busy}
                        className="primary-button"
                        onClick={() => advance(job, 'Ready for checkout')}
                      >
                        Mark ready for checkout
                      </button>
                    )}
                    {status === 'Ready for checkout' &&
                      (job.paymentStatus === 'Paid' ? (
                        <button
                          disabled={busy}
                          className="primary-button"
                          onClick={() => advance(job, 'Completed')}
                        >
                          Release device & complete
                        </button>
                      ) : (
                        <button
                          className="primary-button"
                          onClick={() =>
                            navigate('/pos', {
                              state: job.transactionId
                                ? { collectSaleId: job.transactionId }
                                : { job },
                            })
                          }
                        >
                          Collect payment in POS
                        </button>
                      ))}
                  </div>
                </article>
              )
            })}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <h3>No services in this view</h3>
              <p>Confirmed appointments and walk-in intakes appear here when work begins.</p>
            </div>
          )}
        </>
      )}
      {editing && <ServiceIntake job={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
