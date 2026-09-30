import { CalendarDays, CalendarX2, Check, Cpu, Eye, FileText, PackageCheck, Pencil, Printer, ShoppingBag, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { SearchField } from '../../components/ui/Filters'
import { LoadingState } from '../../components/ui/LoadingState'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { manilaDay, today } from '../../lib/dates'
import { formatDate, formatPHP } from '../../lib/format'
import { shortReference } from '../../lib/reference'
import { buildTransitions, humanError, orderTransitions } from '../../lib/workflow'
import type { CustomerAppointment, CustomPcRequest } from '../../types'
import { advanceBuild, recordBuildApproval } from '../builder/buildOperations'
import { BuildRequestReview } from '../builder/BuildRequestReview'
import { savePcQuote } from '../customer/customerOperations'
import { ServiceIntakeDocument, ServiceIntakePrintRoot } from '../customer/ServiceIntakeDocument'
import { RecordStatus } from '../customer/RecordStatus'
import { appointmentIntake } from '../customer/serviceIntake'
import { useAllRequests } from '../customer/useCustomerRequests'
import { AppointmentReview } from './AppointmentReview'
import { AppointmentDetails } from './AppointmentDetails'
import { receiveAppointmentAsJob, recordSignedServiceIntake, updateAppointmentStatus } from './serviceOperations'

export function RequestQueue(props: {
  scope?: 'appointments' | 'builds' | 'orders'
  query?: string
}) {
  const [params] = useSearchParams()
  return <RequestQueueContent key={params.get('reference') ?? ''} {...props} />
}

function RequestQueueContent({
  scope = 'appointments',
  query = '',
}: {
  scope?: 'appointments' | 'builds' | 'orders'
  query?: string
}) {
  const { user } = useAuth(),
    { confirm } = useConfirmation(),
    navigate = useNavigate()
  const [params] = useSearchParams()
  const { appointments, requests, error: loadError, loading } = useAllRequests(user?.role === 'admin')
  const workspace = useWorkspace()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [quote, setQuote] = useState<CustomPcRequest | null>(null),
    [amount, setAmount] = useState(''),
    [message, setMessage] = useState('')
  const [review, setReview] = useState<CustomPcRequest | null>(null)
  const [appointmentReview, setAppointmentReview] = useState<CustomerAppointment | null>(null)
  const [viewingAppointment, setViewingAppointment] = useState<CustomerAppointment | null>(null)
  const [intakeReview, setIntakeReview] = useState<CustomerAppointment | null>(null)
  const [signedReviewed, setSignedReviewed] = useState(false)
  const [approval, setApproval] = useState<CustomPcRequest | null>(null),
    [approvalNote, setApprovalNote] = useState('')
  const [feedback, setFeedback] = useState('')
  const [buildQuery, setBuildQuery] = useState(params.get('reference') ?? '')
  const [buildFilter, setBuildFilter] = useState('all')
  const [orderQuery, setOrderQuery] = useState(params.get('reference') ?? '')
  const [orderFilter, setOrderFilter] = useState('all')
  const lock = useRef(false)
  async function act(action: () => Promise<unknown>, destructive: boolean | 'no-show' = false) {
    if (lock.current) return
    lock.current = true
    try {
      if (
        destructive &&
        !(await confirm({
          title: destructive === 'no-show' ? 'Mark customer as no-show?' : 'Cancel this record?',
          message: destructive === 'no-show'
            ? 'Use this when the customer did not attend the confirmed appointment. The reserved time is released and the appointment stays in history.'
            : 'The record will remain in history. Any reserved parts will be released.',
          confirmLabel: destructive === 'no-show' ? 'Mark no-show' : 'Cancel record',
          tone: 'danger',
        }))
      )
        return
      setBusy(true)
      setError('')
      setFeedback('')
      await action()
      setFeedback('Record updated.')
    } catch (err) {
      setError(humanError(err))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const bookings = appointments.filter(
    (item) =>
      !item.jobId &&
      `${item.service} ${item.device} ${item.customerName} ${item.customerEmail} ${item.id}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  )
  const buildFilters = [
    { id: 'all', label: 'All requests', statuses: [] },
    { id: 'review', label: 'Needs review', statuses: ['Quote requested', 'Under review'] },
    { id: 'quotes', label: 'Quotes & approval', statuses: ['Quoted', 'Approved'] },
    { id: 'work', label: 'In progress', statuses: ['Parts reserved', 'Assembly', 'Ready'] },
    { id: 'closed', label: 'Closed', statuses: ['Completed', 'Cancelled', 'Declined'] },
  ]
  const buildNextStep: Record<CustomPcRequest['status'], string> = {
    'Quote requested': 'Begin review and check the submitted parts.',
    'Under review': 'Resolve fit and stock issues, then prepare a final quote.',
    Quoted: 'Waiting for the customer to approve this quote.',
    Approved: 'Customer approved the quote. Reserve the available parts.',
    'Parts reserved': 'Parts are held for this build. Start assembly.',
    Assembly: 'Finish assembly and mark the build ready.',
    Ready: 'Collect payment in POS, then complete the build.',
    Completed: 'Build completed.',
    Cancelled: 'Request cancelled.',
    Declined: 'Customer declined the quote.',
  }
  const selectedBuildFilter = buildFilters.find((filter) => filter.id === buildFilter) ?? buildFilters[0]
  const filteredBuilds = requests.filter((item) =>
    (selectedBuildFilter.id === 'all' || selectedBuildFilter.statuses.includes(item.status)) &&
    `${item.id} ${item.customerName ?? ''} ${item.customerEmail ?? ''} ${item.useCase} ${item.status} ${item.parts?.map((part) => part.model).join(' ') ?? ''}`
      .toLowerCase()
      .includes(buildQuery.trim().toLowerCase()),
  )
  const orders = workspace.orders.filter((item) => !item.buildId && !item.serviceJobId)
  const filteredOrders = orders.filter((item) => {
    const status = item.orderStatus ?? 'Requested'
    const matchesStatus = orderFilter === 'all' ||
      (orderFilter === 'open' && !['Completed', 'Cancelled', 'Declined'].includes(status)) ||
      (orderFilter === 'ready' && ['Ready', 'Out for delivery'].includes(status)) ||
      (orderFilter === 'closed' && ['Completed', 'Cancelled', 'Declined'].includes(status))
    return matchesStatus && `${item.customer} ${item.detail} ${item.id} ${status}`
      .toLowerCase().includes(orderQuery.trim().toLowerCase())
  })
  const empty =
    scope === 'appointments'
      ? !bookings.length
      : scope === 'builds'
        ? !filteredBuilds.length
        : !filteredOrders.length
  return (
    <div className={scope === 'appointments' ? 'request-inbox service-request-inbox' : 'request-inbox'}>
      {feedback && (
        <p role="status" className="save-message">
          {feedback}
        </p>
      )}
      {approval && (
        <Dialog
          title="Record customer approval"
          onClose={() => {
            if (!busy) setApproval(null)
          }}
          footer={
            <button className="primary-button" type="submit" form="build-approval" disabled={busy}>
              Record approval
            </button>
          }
        >
          <form
            id="build-approval"
            className="portal-form settings-fields admin-build-dialog-form"
            onSubmit={(event) => {
              event.preventDefault()
              void act(async () => {
                await recordBuildApproval(
                  user!,
                  approval.id,
                  approvalNote,
                  approval.quote!.createdAt,
                )
                setApproval(null)
              })
            }}
          >
            <div className="admin-build-dialog-summary">
              <span className="eyebrow">CUSTOMER APPROVAL</span>
              <h3>{approval.useCase} PC build</h3>
              <p>{approval.customerName || 'Customer'} · {approval.id}</p>
              <strong>{formatPHP(approval.quote?.amount ?? 0)}</strong>
              {approval.quote?.message && <small>{approval.quote.message}</small>}
            </div>
            <p className="admin-build-dialog-guidance">
              Record approval only after the customer accepts this exact quote. Parts are reserved separately.
            </p>
            <label>
              Approval evidence / conversation reference
              <textarea
                required
                maxLength={1000}
                value={approvalNote}
                onChange={(event) => setApprovalNote(event.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
      {appointmentReview && (
        <AppointmentReview
          appointment={appointmentReview}
          onClose={() => setAppointmentReview(null)}
          onSaved={() => {
            setAppointmentReview(null)
            setFeedback('Appointment review saved.')
          }}
        />
      )}
      {viewingAppointment && (
        <AppointmentDetails
          appointment={appointments.find((item) => item.id === viewingAppointment.id) ?? viewingAppointment}
          onClose={() => setViewingAppointment(null)}
        />
      )}
      {intakeReview && (
        <>
          <Dialog
            title="Customer intake & service authorization"
            wide
            onClose={() => {
              if (!busy) setIntakeReview(null)
            }}
            footer={
              <>
                <button type="button" className="secondary-button" onClick={() => window.print()}>
                  <Printer size={17} /> Print form
                </button>
                {!intakeReview.intakeSignedAt && (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy || !signedReviewed || intakeReview.status !== 'Confirmed'}
                    onClick={() =>
                      void act(async () => {
                        await recordSignedServiceIntake(user!, intakeReview.id)
                        setIntakeReview(null)
                      })
                    }
                  >
                    Record signed form collected
                  </button>
                )}
              </>
            }
          >
            <div className="home-intake-review-dialog">
              {!appointmentIntake(intakeReview) && (
                <p className="fulfillment-note">
                  This older request has no saved device intake. Complete the blank fields together
                  on the printed form before collecting signatures.
                </p>
              )}
              {intakeReview.status !== 'Confirmed' && (
                <p className="fulfillment-note">Confirm the appointment before recording a signed form.</p>
              )}
              <ServiceIntakeDocument appointment={intakeReview} />
              {!intakeReview.intakeSignedAt && (
                <label className="check-row home-intake-staff-check">
                  <input
                    type="checkbox"
                    checked={signedReviewed}
                    onChange={(event) => setSignedReviewed(event.target.checked)}
                  />
                  I checked the completed paper form and collected the customer and technician signatures before service.
                </label>
              )}
              {intakeReview.intakeSignedAt && (
                <p className="save-message">Signed paper intake recorded.</p>
              )}
            </div>
          </Dialog>
          <ServiceIntakePrintRoot appointment={intakeReview} />
        </>
      )}
      {(error || loadError) && (
        <p className="form-error" role="alert">
          {error || loadError}
        </p>
      )}
      {scope === 'appointments' && (
        <div className="admin-services-list-heading">
          <div>
            <span className="eyebrow">APPOINTMENT REQUESTS</span>
            <h2>Visits to review</h2>
          </div>
          <span className="result-count" role="status">
            {bookings.length} {bookings.length === 1 ? 'request' : 'requests'}
          </span>
        </div>
      )}
      {scope === 'appointments' && loading && (
        <LoadingState variant="table" label="Loading customer requests…" />
      )}
      {scope === 'builds' && (
        <section className="admin-build-queue" aria-label="Customer build requests">
          <div className="admin-build-queue-heading">
            <div>
              <span className="eyebrow">REQUESTS &amp; QUOTES</span>
              <h2>Customer build requests</h2>
              <p>Review parts and compatibility, then send a final quote for approval.</p>
            </div>
            <span className="result-count" role="status">
              {filteredBuilds.length} {filteredBuilds.length === 1 ? 'build' : 'builds'}
            </span>
          </div>
          <div className="admin-build-queue-controls">
            <div className="admin-build-queue-filters" role="group" aria-label="Build status">
              {buildFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={buildFilter === filter.id}
                  onClick={() => setBuildFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <SearchField label="Search build requests" value={buildQuery} onChange={setBuildQuery} />
          </div>
        </section>
      )}
      {scope === 'builds' && loading && <LoadingState variant="table" label="Loading build requests…" />}
      {scope === 'orders' && (
        <div className="admin-online-order-controls">
          <div className="admin-online-order-filters" role="group" aria-label="Order status">
            {[
              ['all', 'All orders'],
              ['open', 'In progress'],
              ['ready', 'Ready'],
              ['closed', 'Closed'],
            ].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={orderFilter === value}
                onClick={() => setOrderFilter(value)}>{label}</button>
            ))}
          </div>
          <SearchField label="Search online orders" value={orderQuery} onChange={setOrderQuery} />
        </div>
      )}
      {scope === 'orders' && (
        <p className="admin-online-order-count" role="status">
          {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} shown
          <span>{orders.length} total</span>
        </p>
      )}
      {(!loading || scope === 'orders') && empty && (
        <div className="empty-state">
          <h3>
            {scope === 'appointments'
              ? query
                ? 'No appointments match your search'
                : 'No service requests waiting'
              : scope === 'builds'
                ? buildQuery || buildFilter !== 'all'
                  ? 'No builds match your filters'
                  : 'No build requests yet'
                : orderQuery || orderFilter !== 'all' ? 'No orders match your filters' : 'No online orders yet'}
          </h3>
          <p>
            {query && scope === 'appointments'
              ? 'Try another service, device, customer, or reference.'
              : scope === 'builds' && (buildQuery || buildFilter !== 'all')
                ? 'Try another status or search term.'
              : scope === 'orders' && (orderQuery || orderFilter !== 'all')
                ? 'Try another reference, customer, or status.'
                : 'New customer requests will appear here automatically.'}
          </p>
        </div>
      )}
      <div className={scope === 'appointments' ? 'service-record-list' : scope === 'builds' ? 'admin-build-request-list' : 'admin-online-order-list'}>
        {scope === 'appointments' &&
          bookings.map((item) => (
            <article className="service-record-row" key={item.id}>
              <div className="service-record-main">
                <div className="service-record-heading">
                  <span className="service-record-icon" aria-hidden="true">
                    <CalendarDays size={20} />
                  </span>
                  <div className="service-record-title">
                    <h3>{item.service}</h3>
                    <span>{item.device}</span>
                  </div>
                  <RecordStatus status={item.status} />
                </div>
                <dl className="service-record-values">
                  <div>
                    <dt>Customer</dt>
                    <dd>{item.customerName}<small>{item.customerEmail}</small></dd>
                  </div>
                  <div>
                    <dt>Preferred visit</dt>
                    <dd>{formatDate(item.preferredDate)}<small>{item.preferredTime}</small></dd>
                  </div>
                  <div>
                    <dt>Service location</dt>
                    <dd>{item.visit?.mode ?? 'Workshop'}<small>{item.visit?.address}</small></dd>
                  </div>
                  <div>
                    <dt>Reference</dt>
                    <dd className="service-record-reference" title={item.id}>{shortReference(item.id)}</dd>
                  </div>
                </dl>
                {item.status === 'Requested' && (
                  <p className="service-record-step">Next: confirm the available time, or review the schedule and estimate with the customer.</p>
                )}
                {item.status === 'Confirmed' && (
                  <p className="service-record-step">
                    {item.visit && !item.intakeSignedAt
                      ? 'Next: review the intake and record the signed paper form before check-in.'
                      : 'Ready for device check-in and service.'}
                  </p>
                )}
              </div>
              <div
                className="service-record-actions"
                role="group"
                aria-label={`Actions for ${item.service}, ${item.customerName}`}
              >
                <span className="service-record-actions-label">Actions</span>
                <button
                  className="customer-record-action is-primary"
                  type="button"
                  aria-label={`View appointment ${item.id}`}
                  onClick={() => setViewingAppointment(item)}
                >
                  <Eye size={16} /> View
                </button>
                {['Requested', 'Confirmed'].includes(item.status) && (
                  <button
                    className="customer-record-action"
                    type="button"
                    aria-label="Review schedule & estimate"
                    disabled={busy}
                    onClick={() => setAppointmentReview(item)}
                  >
                    <Pencil size={16} /> Review
                  </button>
                )}
                {item.status === 'Requested' && (
                  <button
                    className="customer-record-action is-primary"
                    type="button"
                    aria-label="Confirm appointment"
                    disabled={busy}
                    onClick={() => act(() => updateAppointmentStatus(user!, item.id, 'Confirmed'))}
                  >
                    <Check size={16} /> Confirm
                  </button>
                )}
                {item.status === 'Confirmed' && (
                  <>
                    <button
                      className="customer-record-action is-primary service-record-action-full"
                      type="button"
                      disabled={busy || (!!item.visit && !item.intakeSignedAt)}
                      title={item.visit && !item.intakeSignedAt ? 'Record the signed intake form first.' : undefined}
                      onClick={() => act(() => receiveAppointmentAsJob(user!, item.id))}
                    >
                      {item.visit?.mode === 'Home service' ? 'Start service' : 'Check in device'}
                    </button>
                  </>
                )}
                {item.visit && ['Requested', 'Confirmed'].includes(item.status) && (
                  <button
                    className="customer-record-action service-record-action-full"
                    type="button"
                    aria-label="Review / print intake"
                    onClick={() => {
                      setSignedReviewed(false)
                      setIntakeReview(item)
                    }}
                  >
                    <FileText size={16} /> Intake form
                  </button>
                )}
                {item.status === 'Confirmed' && (
                  <button
                    className="customer-record-action"
                    type="button"
                    title={item.preferredDate > today() ? 'Available on or after the appointment date.' : 'Customer missed the confirmed visit; releases the reserved time.'}
                    disabled={busy || item.preferredDate > today()}
                    onClick={() =>
                      act(() => updateAppointmentStatus(user!, item.id, 'No show'), 'no-show')
                    }
                  >
                    <CalendarX2 size={16} /> No show
                  </button>
                )}
                {['Requested', 'Confirmed'].includes(item.status) && (
                  <button
                    className="customer-record-action is-danger"
                    type="button"
                    aria-label="Cancel appointment"
                    disabled={busy}
                    onClick={() =>
                      act(() => updateAppointmentStatus(user!, item.id, 'Cancelled'), true)
                    }
                  >
                    <X size={16} /> Cancel
                  </button>
                )}
              </div>
            </article>
          ))}
        {scope === 'builds' &&
          filteredBuilds.map((item) => (
            <article className="admin-build-request-row" key={item.id}>
              <div className="admin-build-request-main">
                <div className="admin-build-request-heading">
                  <span className="admin-build-request-icon" aria-hidden="true"><Cpu size={20} /></span>
                  <div>
                    <small>PC PRE-ORDER</small>
                    <h3>{item.useCase} PC build</h3>
                    <span>{item.customerName || 'Customer'} · {item.customerEmail || 'No email recorded'}</span>
                  </div>
                  <RecordStatus status={item.status} />
                </div>
                <dl className="admin-build-request-values">
                  <div><dt>Budget</dt><dd>{item.budget || 'Not specified'}</dd></div>
                  <div><dt>Quote</dt><dd>{item.quote ? formatPHP(item.quote.amount) : 'Pending review'}</dd></div>
                  <div><dt>Parts listed</dt><dd>{item.parts?.length ?? 0} of 8 components</dd></div>
                  <div><dt>Submitted</dt><dd>{formatDate(manilaDay(item.createdAt))}</dd></div>
                </dl>
                <div className="admin-build-request-summary">
                  <p>{item.parts?.length
                    ? item.parts.slice(0, 3).map((part) => `${part.component}: ${part.model}`).join(' · ')
                    : 'No structured parts saved with this request.'}
                    {(item.parts?.length ?? 0) > 3 ? ` · +${item.parts!.length - 3} more` : ''}
                  </p>
                  {item.notes && <small>{item.notes}</small>}
                  {item.quote?.message && <small className="admin-build-quote-preview">Quote: {item.quote.message}</small>}
                </div>
                <p className="admin-build-request-next"><strong>Next step</strong> {buildNextStep[item.status]}</p>
                <small className="admin-build-request-reference" title={item.id}>{shortReference(item.id)}</small>
              </div>
              <div className="admin-build-request-actions" role="group" aria-label={`Actions for ${item.id}`}>
                <span>ACTIONS</span>
                <button type="button" className="customer-record-action is-primary" onClick={() => setReview(item)}>
                  <Eye size={16} /> View components
                </button>
                {item.status === 'Quoted' && item.quote && (
                  <button
                    type="button"
                    className="customer-record-action"
                    disabled={busy}
                    onClick={() => {
                      setApproval(item)
                      setApprovalNote('')
                      setError('')
                    }}
                  >
                    Record approval
                  </button>
                )}
                {(buildTransitions[item.status] ?? [])
                  .filter((next) => !['Quoted', 'Approved', 'Declined'].includes(next))
                  .map((next) => (
                    <button
                      type="button"
                      key={next}
                      className={`customer-record-action ${next === 'Cancelled' ? 'is-danger' : ''}`}
                      disabled={busy}
                      onClick={() =>
                        act(() => advanceBuild(user!, item.id, next), next === 'Cancelled')
                      }
                    >
                      {
                        (
                          {
                            'Under review': 'Begin review',
                            'Parts reserved': 'Reserve parts',
                            Assembly: 'Start assembly',
                            Ready: 'Mark ready',
                            Completed: 'Complete build',
                            Cancelled: 'Cancel request',
                          } as Record<string, string>
                        )[next]
                      }
                    </button>
                  ))}
                {item.status === 'Ready' && item.transactionId && (
                  <button
                    type="button"
                    className="customer-record-action"
                    onClick={() => navigate('/pos', { state: { collectSaleId: item.transactionId } })}
                  >
                    Collect payment in POS
                  </button>
                )}
              </div>
            </article>
          ))}
        {scope === 'orders' &&
          filteredOrders.map((item) => (
              <article className="admin-online-order" key={item.id}>
                <div className="admin-online-order-main">
                  <div className="admin-online-order-heading">
                    <span className="admin-online-order-icon" aria-hidden="true"><ShoppingBag size={19} /></span>
                    <div>
                      <h3>{item.customer}</h3>
                      <span>{item.detail}</span>
                    </div>
                    <span className="admin-online-order-status" data-status={item.orderStatus ?? 'Requested'}>
                      {item.orderStatus ?? 'Requested'}
                    </span>
                  </div>
                  <dl className="admin-online-order-details">
                    <div>
                      <dt>FULFILLMENT</dt>
                      <dd>{item.fulfillment?.mode ?? 'Pickup'}</dd>
                      {item.fulfillment?.address && <small>{item.fulfillment.address}</small>}
                    </div>
                    <div>
                      <dt>PAYMENT</dt>
                      <dd>{item.paymentStatus ?? item.status}</dd>
                      <small>{formatPHP(item.paid)} received</small>
                    </div>
                    <div><dt>TOTAL</dt><dd>{formatPHP(item.total)}</dd></div>
                    <div><dt>REFERENCE</dt><dd className="admin-online-order-reference" title={item.id}>{shortReference(item.id)}</dd></div>
                  </dl>
                </div>
                <div className="admin-online-order-actions">
                  <span className="admin-online-order-actions-label"><PackageCheck size={15} /> NEXT STEPS</span>
                  {(orderTransitions[item.orderStatus ?? 'Requested'] ?? [])
                    .filter(
                      (next) =>
                        next !== 'Out for delivery' || item.fulfillment?.mode === 'Delivery',
                    )
                    .filter((next) => next !== 'Ready' || item.fulfillment?.mode !== 'Delivery')
                    .map((next) => (
                      <button
                        type="button"
                        key={next}
                        disabled={busy}
                        className={next === 'Confirmed' ? 'primary-button' : next === 'Cancelled' ? 'secondary-button admin-online-order-cancel' : 'secondary-button'}
                        onClick={() =>
                          act(
                            () => workspace.updateOrderStatus(item.id, next),
                            next === 'Cancelled',
                          )
                        }
                      >
                        {
                          (
                            {
                              Confirmed: 'Confirm & reserve',
                              Processing: 'Start processing',
                              Ready: 'Ready for pickup',
                              'Out for delivery': 'Out for delivery',
                              Completed: 'Complete order',
                              Cancelled: 'Cancel order',
                            } as Record<string, string>
                          )[next]
                        }
                      </button>
                    ))}
                  {!['Cancelled', 'Declined'].includes(item.orderStatus ?? '') &&
                    item.paid < item.total && (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => navigate('/pos', { state: { collectSaleId: item.id } })}
                      >
                        Open in POS
                      </button>
                    )}
                  {['Completed', 'Cancelled', 'Declined'].includes(item.orderStatus ?? '') && (
                    <p className="admin-online-order-done">
                      {item.orderStatus === 'Completed' ? 'Order fulfilled.' : 'This order is closed.'}
                    </p>
                  )}
                </div>
              </article>
            ))}
      </div>
      {review && (
        <BuildRequestReview
          request={requests.find((item) => item.id === review.id) ?? review}
          onClose={() => setReview(null)}
          onQuote={() => {
            const item = requests.find((item) => item.id === review.id) ?? review
            setReview(null)
            setQuote(item)
            setAmount(item.quote ? String(item.quote.amount) : '')
            setMessage(item.quote?.message ?? '')
          }}
        />
      )}
      {quote && (
        <Dialog
          title="Prepare final quote"
          onClose={() => {
            if (!busy) setQuote(null)
          }}
          footer={
            <button className="primary-button" form="quote-form" type="submit" disabled={busy}>
              Mark quote ready
            </button>
          }
        >
          <form
            id="quote-form"
            className="portal-form settings-fields admin-build-dialog-form"
            onSubmit={(event) => {
              event.preventDefault()
              void act(async () => {
                await savePcQuote(user!, quote.customerId!, quote.id, {
                  amount: Number(amount),
                  message,
                })
                setQuote(null)
              })
            }}
          >
            <div className="admin-build-dialog-summary">
              <span className="eyebrow">FINAL QUOTATION</span>
              <h3>{quote.useCase} PC build</h3>
              <p title={quote.id}>{quote.customerName || 'Customer'} · {shortReference(quote.id)}</p>
              <small>{quote.parts?.length ?? 0} components listed · Budget {quote.budget || 'not specified'}</small>
            </div>
            <label>
              Final quote (PHP)
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Included parts, labor, and review notes
              <textarea
                required
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <p className="admin-build-dialog-guidance">The customer must approve this quote before parts are reserved.</p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </div>
  )
}
