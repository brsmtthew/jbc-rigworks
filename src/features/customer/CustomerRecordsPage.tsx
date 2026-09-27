import { where } from 'firebase/firestore'
import {
  CalendarDays,
  CircleCheck,
  CircleX,
  Cpu,
  Eye,
  FileQuestion,
  Save,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { RecordStatus } from './RecordStatus'
import { ActionButton } from '../../components/ui/ActionButton'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { formatPHP } from '../../lib/format'
import { useShopSettings } from '../../lib/preferences'
import { humanError } from '../../lib/workflow'
import type { CustomerAppointment, CustomPcRequest } from '../../types'
import { availableWindows, slotLabel } from '../services/serviceCatalog'
import { changePendingRequest, respondToPcQuote } from './customerOperations'
import { useCustomerRequests } from './useCustomerRequests'

export function CustomerRecordsPage({
  kind,
  embedded = false,
}: {
  kind: 'appointments' | 'requests'
  embedded?: boolean
}) {
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const [shop] = useShopSettings()
  const [params] = useSearchParams()
  const [selectedChoice, setSelected] = useState<
    CustomerAppointment | CustomPcRequest | null | undefined
  >(undefined)
  const [notesChoice, setNotes] = useState<string | null>(null)
  const [dateChoice, setDate] = useState<string | null>(null)
  const [timeChoice, setTime] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const { appointments, requests, error: loadError, loading } = useCustomerRequests(user)
  const rows = kind === 'appointments' ? appointments : requests
  const selected =
    selectedChoice === undefined
      ? (rows.find((item) => item.id === params.get('reference')) ?? null)
      : selectedChoice
  const notes = notesChoice ?? selected?.notes ?? ''
  const date = dateChoice ?? (selected && 'preferredDate' in selected ? selected.preferredDate : '')
  const time = timeChoice ?? (selected && 'preferredTime' in selected ? selected.preferredTime : '')
  const slots = useLiveCollection<{ id: string; count: number }>(
    'appointmentSlots',
    !!user && !!date && kind === 'appointments',
    [where('date', '==', date)],
    date,
  )
  const windows = availableWindows(
    date,
    shop.schedule,
    slots.rows,
    shop.services.find(
      (service) => selected && 'serviceId' in selected && service.id === selected.serviceId,
    )?.durationMinutes,
  )
  const { error, setError, busy, run } = useAsyncAction()

  if (!user) return null
  const isAppointments = kind === 'appointments'
  const filtered = rows.filter(
    (item) =>
      (statusFilter === 'All' || item.status === statusFilter) &&
      `${item.id} ${'service' in item ? item.service + item.device : item.useCase}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )

  function open(item: CustomerAppointment | CustomPcRequest) {
    setSelected(item)
    setNotes(item.notes)
    setDate('preferredDate' in item ? item.preferredDate : '')
    setTime('preferredDate' in item ? item.preferredTime : '')
    setError('')
  }

  async function change(remove = false) {
    return run(async () => {
      if (!selected) return
      try {
        if (!remove && 'preferredDate' in selected && (!date || date < today() || !time)) {
          throw new Error('Select a current or future date and a time.')
        }
        if (
          !(await confirm({
            title: remove ? 'Cancel request?' : 'Save request changes?',
            message: remove
              ? 'Cancel this pending request? It will remain in your history.'
              : 'Save your changes to this request?',
            confirmLabel: remove ? 'Cancel request' : 'Save changes',
            tone: remove ? 'danger' : 'primary',
          }))
        )
          return
        await changePendingRequest(
          user!,
          kind,
          selected.id,
          remove ? null : { notes, preferredDate: date, preferredTime: time },
        )
        setSelected(null)
        setError('')
      } catch (err) {
        setError(humanError(err))
      }
    })
  }

  async function respondToQuote(response: 'Approved' | 'Declined') {
    return run(async () => {
      if (!user || !selected || 'service' in selected) return
      if (
        !(await confirm({
          title: response === 'Approved' ? 'Accept this quote?' : 'Decline this quote?',
          message:
            response === 'Approved'
              ? 'Record your approval for this PC build quote?'
              : 'Record that you are declining this PC build quote?',
          confirmLabel: response === 'Approved' ? 'Accept quote' : 'Decline quote',
          tone: response === 'Declined' ? 'danger' : 'primary',
        }))
      )
        return
      try {
        setSelected(await respondToPcQuote(user, selected.id, response))
        setError('')
      } catch (err) {
        setError(humanError(err))
      }
    })
  }

  const editable =
    selected && ['Requested', 'Quote requested', 'Under review'].includes(selected.status)
  const quotedPcRequest =
    selected && !('service' in selected) && selected.status === 'Quoted' && selected.quote

  return (
    <>
      {!embedded && (
        <PageHeader
          eyebrow="CUSTOMER PORTAL"
          title={isAppointments ? 'My appointments' : 'My PC requests'}
          description="Your saved requests and their details."
        />
      )}
      <div className="record-filters">
        <label>
          Search records
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Service, build or reference"
          />
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option>All</option>
            {[...new Set(rows.map((item) => item.status))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <Panel title={isAppointments ? 'Appointment requests' : 'Custom build requests'}>
        {loadError ? (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        ) : loading ? (
          <p role="status">Loading requests…</p>
        ) : !rows.length ? (
          <div className="customer-empty large">
            <FileQuestion size={30} />
            <h3>{isAppointments ? 'No appointments yet' : 'No PC requests yet'}</h3>
            <Link
              className="primary-button"
              to={isAppointments ? '/customer/book' : '/customer/pc-building'}
            >
              {isAppointments ? <CalendarDays size={16} /> : <Cpu size={16} />}
              {isAppointments ? 'Book a service' : 'Start a PC request'}
            </Link>
          </div>
        ) : (
          <div className="request-records">
            {!filtered.length && (
              <p className="customer-empty">No records match your search or status filter.</p>
            )}
            {filtered.map((item) => (
              <article key={item.id}>
                <div className="request-record-heading">
                  <div>
                    <strong>{'service' in item ? item.service : item.useCase + ' PC'}</strong>
                    <small>
                      {'device' in item ? item.device : item.parts?.length + ' components'}
                    </small>
                  </div>
                  <RecordStatus status={item.status} />
                </div>
                <p>
                  {'preferredDate' in item
                    ? item.preferredDate + ' / ' + item.preferredTime
                    : 'Compatibility and quote reviewed by JBC'}
                </p>
                <small className="record-reference">{item.id}</small>
                <ActionButton
                  variant="labeled"
                  label={'service' in item ? 'View appointment details' : 'View selected parts'}
                  onClick={() => open(item)}
                >
                  <Eye size={20} />
                </ActionButton>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {selected && (
        <Dialog
          title={'service' in selected ? 'Appointment details' : 'Build request details'}
          onClose={() => {
            if (!busy) setSelected(null)
          }}
        >
          <div className="portal-form settings-fields">
            <RecordStatus status={selected.status} />
            <small className="record-reference">{selected.id}</small>
            {'service' in selected ? (
              <>
                <h3>
                  {selected.service} / {selected.device}
                </h3>
                {selected.reviewedEstimate !== undefined && (
                  <p>
                    <strong>
                      Reviewed estimate before tax: {formatPHP(selected.reviewedEstimate)}
                    </strong>
                  </p>
                )}
                {selected.reviewNote && <p>Workshop review: {selected.reviewNote}</p>}
                {selected.visit && (
                  <>
                    <p>
                      {selected.visit.mode} / {selected.visit.address}{' '}
                      {selected.visit.mode === 'Home service'
                        ? selected.visit.distanceKm
                          ? selected.visit.distanceKm + ' km one way'
                          : 'Distance pending address review'
                        : ''}
                    </p>
                    <dl className="checkout-totals">
                      {[
                        ['Service', selected.visit.basePrice],
                        ['Home surcharge', selected.visit.surcharge],
                        ['Transportation', selected.visit.transport],
                        ['Estimated total', selected.visit.estimate],
                      ]
                        .filter(
                          ([label, value]) =>
                            label === 'Service' ||
                            label === 'Estimated total' ||
                            (selected.visit?.mode === 'Home service' && value !== 0),
                        )
                        .map(([label, value]) => (
                          <div key={String(label)}>
                            <dt>{label}</dt>
                            <dd>{value === null ? 'Quote required' : formatPHP(Number(value))}</dd>
                          </div>
                        ))}
                    </dl>
                  </>
                )}
                <label>
                  Preferred date
                  <input
                    type="date"
                    required
                    min={today()}
                    disabled={!editable || busy}
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value)
                      setTime('')
                    }}
                  />
                </label>
                <label>
                  Preferred time
                  <select
                    disabled={!editable}
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  >
                    <option value="">Choose an available time</option>
                    {[...new Set([time, ...windows.map(slotLabel)])]
                      .filter(Boolean)
                      .map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                  </select>
                </label>
                {slots.error && (
                  <p className="form-error" role="alert">
                    {slots.error}
                  </p>
                )}
              </>
            ) : (
              <>
                <p>
                  {selected.useCase} / Budget {selected.budget || 'Not specified'}
                </p>
                {selected.parts?.map((part) => (
                  <p key={part.component}>
                    <strong>{part.component}:</strong>{' '}
                    {[part.brand, part.model].filter(Boolean).join(' / ')} ({part.source})
                    {part.price !== undefined && !['Custom', 'customer_owned'].includes(part.source)
                      ? ` / ${formatPHP(part.price)}`
                      : ''}
                    {part.specs ? <small className="request-part-specs">{part.specs}</small> : null}
                  </p>
                ))}
                {selected.quote && (
                  <section className="quote-card" aria-label="Workshop quote">
                    <span className="eyebrow">WORKSHOP QUOTE</span>
                    <strong>{formatPHP(selected.quote.amount)}</strong>
                    <p>{selected.quote.message}</p>
                    <small>
                      Prepared {new Date(selected.quote.createdAt).toLocaleDateString('en-PH')}
                    </small>
                  </section>
                )}
                {quotedPcRequest && (
                  <p className="storage-caption">
                    Accepting records your approval for this build. It does not collect payment or
                    place an order.
                  </p>
                )}
              </>
            )}

            <label>
              Request notes
              <textarea
                rows={4}
                maxLength={1000}
                value={notes}
                disabled={!editable}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {editable && (
              <div className="dialog-actions">
                <ActionButton
                  disabled={busy}
                  variant="labeled"
                  label="Cancel request"
                  onClick={() => change(true)}
                >
                  <Trash2 size={20} />
                </ActionButton>
                <ActionButton
                  variant="labeled"
                  disabled={busy || slots.loading || !!slots.error}
                  label="Save request changes"
                  onClick={() => change()}
                >
                  <Save size={18} />
                </ActionButton>
              </div>
            )}
            {quotedPcRequest && (
              <div className="dialog-actions quote-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => respondToQuote('Declined')}
                >
                  <CircleX size={18} />
                  Decline quote
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => respondToQuote('Approved')}
                >
                  <CircleCheck size={18} />
                  Accept quote
                </button>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  )
}
