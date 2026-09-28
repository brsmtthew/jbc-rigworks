import { Printer } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../lib/auth-context'
import { formatPHP } from '../../lib/format'
import { buildTransitions, humanError, orderTransitions } from '../../lib/workflow'
import type { CustomerAppointment, CustomPcRequest } from '../../types'
import { advanceBuild, recordBuildApproval } from '../builder/buildOperations'
import { BuildRequestReview } from '../builder/BuildRequestReview'
import { savePcQuote } from '../customer/customerOperations'
import { ServiceIntakeDocument, ServiceIntakePrintRoot } from '../customer/ServiceIntakeDocument'
import { appointmentIntake } from '../customer/serviceIntake'
import { useAllRequests } from '../customer/useCustomerRequests'
import { AppointmentReview } from './AppointmentReview'
import { receiveAppointmentAsJob, recordSignedServiceIntake, updateAppointmentStatus } from './serviceOperations'

export function RequestQueue({
  scope = 'appointments',
}: {
  scope?: 'appointments' | 'builds' | 'orders'
}) {
  const { user } = useAuth(),
    { confirm } = useConfirmation(),
    navigate = useNavigate()
  const { appointments, requests, error: loadError } = useAllRequests(user?.role === 'admin')
  const workspace = useWorkspace()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [quote, setQuote] = useState<CustomPcRequest | null>(null),
    [amount, setAmount] = useState(''),
    [message, setMessage] = useState('')
  const [review, setReview] = useState<CustomPcRequest | null>(null)
  const [appointmentReview, setAppointmentReview] = useState<CustomerAppointment | null>(null)
  const [intakeReview, setIntakeReview] = useState<CustomerAppointment | null>(null)
  const [signedReviewed, setSignedReviewed] = useState(false)
  const [approval, setApproval] = useState<CustomPcRequest | null>(null),
    [approvalNote, setApprovalNote] = useState('')
  const [feedback, setFeedback] = useState('')
  const lock = useRef(false)
  async function act(action: () => Promise<unknown>, destructive = false) {
    if (lock.current) return
    lock.current = true
    try {
      if (
        destructive &&
        !(await confirm({
          title: 'Cancel this record?',
          message: 'The record will remain in history. Any reserved parts will be released.',
          confirmLabel: 'Cancel record',
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
  const bookings = appointments.filter((item) => !item.jobId)
  const empty =
    scope === 'appointments'
      ? !bookings.length
      : scope === 'builds'
        ? !requests.length
        : !workspace.orders.length
  return (
    <div className="request-inbox">
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
            className="portal-form settings-fields"
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
            <h3>
              {approval.customerName} / {formatPHP(approval.quote?.amount ?? 0)}
            </h3>
            <p>{approval.quote?.message}</p>
            <p>
              Use this only after the customer has approved this exact quote. Parts are reserved
              separately.
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
      {empty && (
        <div className="empty-state">
          <h3>
            {scope === 'appointments'
              ? 'No service requests waiting'
              : scope === 'builds'
                ? 'No build requests yet'
                : 'No online orders yet'}
          </h3>
          <p>New customer requests will appear here automatically.</p>
        </div>
      )}
      <div className="jobs-grid">
        {scope === 'appointments' &&
          bookings.map((item) => (
            <article className="job-card" key={item.id}>
              <span className="eyebrow">{item.status}</span>
              <h2>{item.service}</h2>
              <p>{item.device}</p>
              <p>
                {item.customerName} · {item.customerEmail}
              </p>
              <p>
                {item.preferredDate} · {item.preferredTime}
              </p>
              <p>
                {item.visit?.mode ?? 'Workshop'} {item.visit?.address}
              </p>
              <p>{item.notes}</p>
              {item.visit && (
                <p className="home-intake-queue-status">
                  {item.intakeSignedAt ? 'Signed paper intake recorded' : 'Printed intake and signatures required before service'}
                </p>
              )}
              <div className="job-card-actions">
                {item.visit && ['Requested', 'Confirmed'].includes(item.status) && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setSignedReviewed(false)
                      setIntakeReview(item)
                    }}
                  >
                    <Printer size={17} /> Review / print intake
                  </button>
                )}
                {item.status === 'Requested' && (
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => act(() => updateAppointmentStatus(user!, item.id, 'Confirmed'))}
                  >
                    Confirm appointment
                  </button>
                )}
                {['Requested', 'Confirmed'].includes(item.status) && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => setAppointmentReview(item)}
                  >
                    Review schedule & estimate
                  </button>
                )}
                {item.status === 'Confirmed' && (
                  <>
                    <button
                      className="primary-button"
                      disabled={busy || (!!item.visit && !item.intakeSignedAt)}
                      onClick={() => act(() => receiveAppointmentAsJob(user!, item.id))}
                    >
                      {item.visit?.mode === 'Home service' ? 'Start service' : 'Check in device'}
                    </button>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        act(() => updateAppointmentStatus(user!, item.id, 'No show'), true)
                      }
                    >
                      Mark no show
                    </button>
                  </>
                )}
                {['Requested', 'Confirmed'].includes(item.status) && (
                  <button
                    className="text-button danger-button"
                    disabled={busy}
                    onClick={() =>
                      act(() => updateAppointmentStatus(user!, item.id, 'Cancelled'), true)
                    }
                  >
                    Cancel appointment
                  </button>
                )}
              </div>
            </article>
          ))}
        {scope === 'builds' &&
          requests.map((item) => (
            <article className="job-card" key={item.id}>
              <span className="eyebrow">{item.status}</span>
              <h2>{item.useCase} PC</h2>
              <p>
                {item.customerName} · {item.customerEmail}
              </p>
              <p>{item.notes}</p>
              <ul>
                {item.parts?.map((part) => (
                  <li key={part.component}>
                    {part.component}: {part.model} ·{' '}
                    {['Custom', 'customer_owned'].includes(part.source)
                      ? 'Customer owned'
                      : 'JBC inventory'}
                  </li>
                ))}
              </ul>
              <p>
                {item.quote
                  ? `Final quote ${formatPHP(item.quote.amount)}`
                  : `Budget ${item.budget || 'Not specified'}`}
              </p>
              {item.quote && <p>{item.quote.message}</p>}
              <div className="job-card-actions">
                <button className="primary-button" onClick={() => setReview(item)}>
                  Review components & compatibility
                </button>
                {item.status === 'Quoted' && item.quote && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      setApproval(item)
                      setApprovalNote('')
                      setError('')
                    }}
                  >
                    Record customer approval
                  </button>
                )}
                {(buildTransitions[item.status] ?? [])
                  .filter((next) => !['Quoted', 'Approved', 'Declined'].includes(next))
                  .map((next) => (
                    <button
                      key={next}
                      className={
                        next === 'Cancelled' ? 'text-button danger-button' : 'secondary-button'
                      }
                      disabled={busy}
                      onClick={() =>
                        act(() => advanceBuild(user!, item.id, next), next === 'Cancelled')
                      }
                    >
                      {
                        (
                          {
                            'Under review': 'Review build',
                            'Parts reserved': 'Reserve parts',
                            Assembly: 'Start assembly',
                            Ready: 'Mark ready',
                            Completed: 'Complete build',
                            Cancelled: 'Cancel build',
                          } as Record<string, string>
                        )[next]
                      }
                    </button>
                  ))}
                {item.status === 'Ready' && item.transactionId && (
                  <button
                    className="primary-button"
                    onClick={() =>
                      navigate('/pos', { state: { collectSaleId: item.transactionId } })
                    }
                  >
                    Collect payment in POS
                  </button>
                )}
              </div>
            </article>
          ))}
        {scope === 'orders' &&
          workspace.orders
            .filter((item) => !item.buildId && !item.serviceJobId)
            .map((item) => (
              <article className="job-card" key={item.id}>
                <span className="eyebrow">
                  {item.orderStatus ?? 'Requested'} · {item.paymentStatus ?? item.status}
                </span>
                <h2>{item.customer}</h2>
                <p>{item.detail}</p>
                <p>
                  {item.fulfillment?.mode ?? 'Pickup'} {item.fulfillment?.address}
                </p>
                <strong>{formatPHP(item.total)}</strong>
                <small>{item.id}</small>
                <div className="job-card-actions">
                  {(orderTransitions[item.orderStatus ?? 'Requested'] ?? [])
                    .filter(
                      (next) =>
                        next !== 'Out for delivery' || item.fulfillment?.mode === 'Delivery',
                    )
                    .filter((next) => next !== 'Ready' || item.fulfillment?.mode !== 'Delivery')
                    .map((next) => (
                      <button
                        key={next}
                        disabled={busy}
                        className="secondary-button"
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
                        className="primary-button"
                        onClick={() => navigate('/pos', { state: { collectSaleId: item.id } })}
                      >
                        Open in POS
                      </button>
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
            className="portal-form settings-fields"
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
            <p>Customer approval is required before reserving parts.</p>
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
