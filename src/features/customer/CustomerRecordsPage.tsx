import { where } from 'firebase/firestore'
import {
  CalendarDays,
  CircleCheck,
  CircleX,
  Cpu,
  Eye,
  FileQuestion,
  FileText,
  Pencil,
  Printer,
  Save,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { RecordStatus } from './RecordStatus'
import { ActionButton } from '../../components/ui/ActionButton'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { formatDate, formatPHP } from '../../lib/format'
import { useShopSettings } from '../../lib/preferences'
import { shortReference } from '../../lib/reference'
import { humanError } from '../../lib/workflow'
import type { CustomerAppointment, CustomPcRequest, ServiceIntake } from '../../types'
import { availableWindows, slotLabel, type AppointmentSlot } from '../services/serviceCatalog'
import { changePendingRequest, respondToPcQuote } from './customerOperations'
import { useCustomerRequests } from './useCustomerRequests'
import { ServiceIntakePrintRoot } from './ServiceIntakeDocument'
import { ServiceIntakePreview } from './ServiceIntakePreview'
import { RecordPrintRoot } from './RecordPrintRoot'
import { appointmentIntake } from './serviceIntake'
import { emptyServiceIntake } from './serviceIntake'
import { ServiceIntakeFields } from './ServiceIntakeFields'

const canEditRequest = (item: CustomerAppointment | CustomPcRequest) =>
  'service' in item
    ? item.status === 'Requested' && !item.reviewNote
    : item.status === 'Quote requested'

export function CustomerRecordsPage({
  kind,
  embedded = false,
}: {
  kind: 'appointments' | 'requests'
  embedded?: boolean
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { confirm } = useConfirmation()
  const [shop] = useShopSettings()
  const [params] = useSearchParams()
  const [selectedChoice, setSelected] = useState<
    CustomerAppointment | CustomPcRequest | null | undefined
  >(undefined)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [printChoice, setPrintChoice] = useState<CustomerAppointment | CustomPcRequest | null>(null)
  const [intakePreview, setIntakePreview] = useState<CustomerAppointment | null>(null)
  const [notesChoice, setNotes] = useState<string | null>(null)
  const [dateChoice, setDate] = useState<string | null>(null)
  const [timeChoice, setTime] = useState<string | null>(null)
  const [deviceChoice, setDevice] = useState<string | null>(null)
  const [specsChoice, setSpecs] = useState<string | null>(null)
  const [unknownChoice, setUnknown] = useState<boolean | null>(null)
  const [addressChoice, setAddress] = useState<string | null>(null)
  const [intakeChoice, setIntake] = useState<ServiceIntake | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const { appointments, requests, error: loadError, loading } = useCustomerRequests(user)
  const rows = kind === 'appointments' ? appointments : requests
  const selected =
    selectedChoice === undefined
      ? (rows.find((item) => item.id === params.get('reference')) ?? null)
      : selectedChoice
        ? (rows.find((item) => item.id === selectedChoice.id) ?? selectedChoice)
        : null
  const notes = notesChoice ?? selected?.notes ?? ''
  const date = dateChoice ?? (selected && 'preferredDate' in selected ? selected.preferredDate : '')
  const time = timeChoice ?? (selected && 'preferredTime' in selected ? selected.preferredTime : '')
  const device = deviceChoice ?? (selected && 'device' in selected ? selected.device : '')
  const specs =
    specsChoice ?? (selected && 'specifications' in selected ? (selected.specifications ?? '') : '')
  const unknown =
    unknownChoice ??
    (selected && 'unknownSpecifications' in selected
      ? (selected.unknownSpecifications ?? false)
      : false)
  const address =
    addressChoice ?? (selected && 'visit' in selected ? (selected.visit?.address ?? '') : '')
  const intake =
    intakeChoice ??
    (selected && 'service' in selected
      ? (selected.serviceIntake ?? emptyServiceIntake)
      : emptyServiceIntake)
  const slots = useLiveCollection<AppointmentSlot>(
    'appointmentSlots',
    !!user && !!date && kind === 'appointments',
    [where('date', '==', date)],
    date,
  )
  const counts = slots.rows.map((slot) => ({
    ...slot,
    count: Math.max(
      0,
      slot.count -
        (selected &&
        'slotId' in selected &&
        selected.slotId === slot.id &&
        slot.holds?.[selected.id]
          ? 1
          : 0),
    ),
  }))
  const windows = availableWindows(
    date,
    shop.schedule,
    counts,
    shop.services.find(
      (service) => selected && 'serviceId' in selected && service.id === selected.serviceId,
    )?.durationMinutes,
  )
  const { error, setError, busy, run } = useAsyncAction()

  if (!user) return null
  const isAppointments = kind === 'appointments'
  const filtered = rows
    .filter(
      (item) =>
        (statusFilter === 'All' || item.status === statusFilter) &&
        `${item.id} ${'service' in item ? item.service + item.device : item.useCase}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  function open(item: CustomerAppointment | CustomPcRequest, nextMode: 'view' | 'edit' = 'view') {
    setSelected(item)
    setMode(nextMode)
    setPrintChoice(null)
    setNotes(item.notes)
    setDate('preferredDate' in item ? item.preferredDate : '')
    setTime('preferredDate' in item ? item.preferredTime : '')
    setDevice('device' in item ? item.device : '')
    setSpecs('specifications' in item ? (item.specifications ?? '') : '')
    setUnknown('unknownSpecifications' in item ? (item.unknownSpecifications ?? false) : false)
    setAddress('visit' in item ? (item.visit?.address ?? '') : '')
    setIntake('service' in item ? (item.serviceIntake ?? emptyServiceIntake) : emptyServiceIntake)
    setError('')
  }

  async function change() {
    return run(async () => {
      if (!selected) return
      try {
        if ('preferredDate' in selected && (!date || date < today() || !time)) {
          throw new Error('Select a current or future date and a time.')
        }
        if (
          !(await confirm({
            title: 'Save request changes?',
            message: 'Save your changes to this request?',
            confirmLabel: 'Save changes',
            tone: 'primary',
          }))
        )
          return
        await changePendingRequest(user!, kind, selected.id, {
          notes,
          preferredDate: date,
          preferredTime: time,
          ...('service' in selected
            ? {
                device,
                specifications: specs,
                unknownSpecifications: unknown,
                serviceIntake: intake,
                visitAddress: address,
              }
            : {}),
        })
        setSelected(null)
        setError('')
      } catch (err) {
        setError(humanError(err))
      }
    })
  }

  async function cancel(item: CustomerAppointment | CustomPcRequest) {
    return run(async () => {
      if (
        !(await confirm({
          title: 'Cancel request?',
          message: `Cancel ${'service' in item ? item.service : item.useCase + ' PC'} (${item.id})? It will remain in your history.`,
          confirmLabel: 'Cancel request',
          tone: 'danger',
        }))
      )
        return
      await changePendingRequest(user!, kind, item.id, null)
      if (selected?.id === item.id) setSelected(null)
    })
  }

  function printRecord(item: CustomerAppointment | CustomPcRequest) {
    flushSync(() => setPrintChoice(item))
    window.addEventListener('afterprint', () => setPrintChoice(null), { once: true })
    window.print()
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

  const editable = selected && canEditRequest(selected)
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
      {error && !selected && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Panel title={isAppointments ? 'Appointment requests' : 'Custom build requests'}>
        {loadError ? (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        ) : loading ? (
          <LoadingState variant="table" label="Loading requests…" />
        ) : !rows.length ? (
          <div className="customer-empty large">
            <FileQuestion size={30} />
            <h3>{isAppointments ? 'No appointments yet' : 'No PC requests yet'}</h3>
            <Link
              className="primary-button"
              to={isAppointments ? '/customer/book' : '/customer/pc-building'}
            >
              {isAppointments ? <CalendarDays size={16} /> : <Cpu size={16} />}
              {isAppointments ? 'Book a service' : 'Start a PC pre-order'}
            </Link>
          </div>
        ) : (
          <div className="request-records">
            <p className="customer-records-sort-note">Newest requests first</p>
            {!filtered.length && (
              <p className="customer-empty">No records match your search or status filter.</p>
            )}
            {filtered.map((item) => (
              <article key={item.id}>
                <div className="request-record-heading">
                  <span className="customer-order-card-icon" aria-hidden="true">
                    {'service' in item ? <CalendarDays size={20} /> : <Cpu size={20} />}
                  </span>
                  <div className="request-record-title">
                    <strong>
                      {'service' in item
                        ? item.service
                        : item.notes.split('\n')[0]?.trim() || item.useCase + ' PC'}
                    </strong>
                    <small>
                      {'device' in item ? item.device : item.parts?.length + ' components'}
                    </small>
                  </div>
                  <RecordStatus
                    status={item.status}
                    label={
                      'requestType' in item &&
                      item.requestType === 'Pre-order' &&
                      item.status === 'Quote requested'
                        ? 'Pre-order requested'
                        : undefined
                    }
                  />
                </div>
                <dl className="customer-record-values customer-request-meta">
                  <div>
                    <dt>{'preferredDate' in item ? 'Preferred visit' : 'Next step'}</dt>
                    <dd>
                      {'preferredDate' in item
                        ? `${formatDate(item.preferredDate)} · ${item.preferredTime}`
                        : item.requestType === 'Pre-order'
                          ? 'Pre-order review'
                          : 'Workshop quote review'}
                    </dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>
                      {new Date(item.createdAt).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                  <div className="customer-record-value-reference">
                    <dt>Reference</dt>
                    <dd className="record-reference" title={item.id}>{shortReference(item.id)}</dd>
                  </div>
                </dl>
                <div
                  className="customer-record-actions"
                  role="group"
                  aria-label={`Actions for ${item.id}`}
                >
                  <span className="customer-record-actions-label">Actions</span>
                  <button
                    type="button"
                    className="customer-record-action is-primary"
                    aria-label={`View ${item.id}`}
                    onClick={() => open(item)}
                  >
                    <Eye size={16} /> View
                  </button>
                  {
                    <>
                      <button
                        type="button"
                        className="customer-record-action"
                        aria-label={`Edit ${item.id}`}
                        disabled={!canEditRequest(item)}
                        title={canEditRequest(item) ? undefined : 'Locked after workshop review'}
                        onClick={() =>
                          'service' in item
                            ? open(item, 'edit')
                            : navigate(`/customer/pc-building?edit=${encodeURIComponent(item.id)}`)
                        }
                      >
                        <Pencil size={16} /> Edit
                      </button>
                      <button
                        type="button"
                        className="customer-record-action is-danger"
                        aria-label={`Cancel ${item.id}`}
                        disabled={busy || !canEditRequest(item)}
                        title={canEditRequest(item) ? undefined : 'Locked after workshop review'}
                        onClick={() => void cancel(item)}
                      >
                        <Trash2 size={16} /> Cancel
                      </button>
                    </>
                  }
                  <button
                    type="button"
                    className="customer-record-action"
                    aria-label={`Print ${item.id}`}
                    onClick={() => printRecord(item)}
                  >
                    <Printer size={16} /> Print
                  </button>
                  {'service' in item && appointmentIntake(item) && (
                    <button
                      type="button"
                      className="customer-record-action customer-record-intake-action"
                      aria-label={`View intake form ${item.id}`}
                      onClick={() => setIntakePreview(item)}
                    >
                      <FileText size={16} /> Intake form
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {selected && (
        <Dialog
          title={`${mode === 'edit' ? 'Edit' : 'View'} ${'service' in selected ? 'appointment' : 'build request'}`}
          wide={'service' in selected}
          onClose={() => {
            if (!busy) setSelected(null)
          }}
        >
          <div
            className={`portal-form settings-fields ${'service' in selected ? 'customer-appointment-dialog' : ''}`}
          >
            <RecordStatus
              status={selected.status}
              label={
                'requestType' in selected &&
                selected.requestType === 'Pre-order' &&
                selected.status === 'Quote requested'
                  ? 'Pre-order requested'
                  : undefined
              }
            />
            <small className="record-reference">{selected.id}</small>
            {'service' in selected ? (
              <>
                <div className="customer-appointment-layout">
                  <aside className="customer-appointment-overview">
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
                            ...(selected.selectedCharges ?? []).map((charge) => [charge.name, charge.price] as const),
                            ['Home surcharge', selected.visit.surcharge],
                            ['Transportation', selected.visit.transport],
                            ['Estimated total', selected.visit.estimate],
                          ]
                            .filter(
                              ([label, value]) =>
                                label === 'Service' ||
                                label === 'Estimated total' ||
                                selected.selectedCharges?.some((charge) => charge.name === label) ||
                                (selected.visit?.mode === 'Home service' && value !== 0),
                            )
                            .map(([label, value]) => (
                              <div key={String(label)}>
                                <dt>{label}</dt>
                                <dd>
                                  {value === null ? 'Quote required' : formatPHP(Number(value))}
                                </dd>
                              </div>
                            ))}
                        </dl>
                      </>
                    )}
                    {appointmentIntake(selected) && (
                      <section className="customer-intake-summary">
                        <div>
                          <span className="eyebrow">CUSTOMER INTAKE</span>
                          <h4>Device condition record</h4>
                          <p>
                            {appointmentIntake(selected)?.powerStatus} ·{' '}
                            {appointmentIntake(selected)?.visibleCondition}
                          </p>
                          <small>
                            Review and sign the printed form with the technician before service.
                          </small>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setIntakePreview(selected)}
                        >
                          <FileText size={17} /> View full form
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => printRecord(selected)}
                        >
                          <Printer size={17} /> Print intake form
                        </button>
                      </section>
                    )}
                  </aside>
                  <div className="customer-appointment-details">
                    <h3>{mode === 'edit' ? 'Update visit and intake' : 'Visit details'}</h3>
                    {mode === 'edit' && (
                      <>
                        <label>
                          Device brand / model
                          <input
                            required
                            maxLength={160}
                            value={device}
                            disabled={!editable}
                            onChange={(event) => setDevice(event.target.value)}
                          />
                        </label>
                        <label>
                          Known specifications (optional)
                          <input
                            maxLength={500}
                            value={specs}
                            disabled={!editable || unknown}
                            onChange={(event) => setSpecs(event.target.value)}
                          />
                        </label>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={unknown}
                            disabled={!editable}
                            onChange={(event) => setUnknown(event.target.checked)}
                          />
                          Specifications unknown
                        </label>
                        {selected.visit?.mode === 'Home service' && (
                          <label>
                            Home-service address
                            <textarea
                              required
                              maxLength={400}
                              value={address}
                              disabled={!editable}
                              onChange={(event) => setAddress(event.target.value)}
                            />
                          </label>
                        )}
                        <fieldset className="customer-intake-edit-fields" disabled={!editable}>
                          <ServiceIntakeFields
                            value={intake}
                            onChange={setIntake}
                            service={selected.service}
                            serviceId={selected.serviceId}
                            device={device}
                            concerns={notes}
                            acknowledged
                            onAcknowledge={() => {}}
                            editing
                          />
                        </fieldset>
                      </>
                    )}
                    {mode === 'edit' ? (
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
                    ) : (
                      <p>Preferred date: {date || 'Not set'}</p>
                    )}
                    {mode === 'edit' ? (
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
                    ) : (
                      <p>Preferred time: {time || 'Not set'}</p>
                    )}
                    {slots.error && (
                      <p className="form-error" role="alert">
                        {slots.error}
                      </p>
                    )}
                    {mode === 'edit' ? (
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
                    ) : (
                      <p>Request notes: {notes || 'None provided'}</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <p>
                  {selected.requestType === 'Pre-order' ? 'PC pre-order' : 'PC build request'} ·{' '}
                  {selected.useCase} / Budget {selected.budget || 'Not specified'}
                </p>
                <p>Estimated tier: {selected.tier || 'Unclassified'}</p>
                {editable && mode === 'view' && (
                  <Link
                    className="secondary-button"
                    to={`/customer/pc-building?edit=${encodeURIComponent(selected.id)}`}
                  >
                    <Pencil size={16} /> Edit parts and pre-order
                  </Link>
                )}
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

            {!('service' in selected) &&
              (mode === 'edit' ? (
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
              ) : (
                <p>Request notes: {notes || 'None provided'}</p>
              ))}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {editable && mode === 'edit' && (
              <div className="dialog-actions">
                <button type="button" className="secondary-button" onClick={() => setMode('view')}>
                  Discard edits
                </button>
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
            {quotedPcRequest && mode === 'view' && (
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
      {printChoice && 'service' in printChoice && appointmentIntake(printChoice) ? (
        <ServiceIntakePrintRoot appointment={printChoice} />
      ) : printChoice ? (
        <RecordPrintRoot record={printChoice} />
      ) : null}
      {intakePreview && (
        <ServiceIntakePreview
          appointment={intakePreview}
          onClose={() => setIntakePreview(null)}
          onPrint={() => printRecord(intakePreview)}
        />
      )}
    </>
  )
}
