import { where } from 'firebase/firestore'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  House,
  Laptop,
  MapPin,
  Monitor,
  Printer,
  Search,
  Send,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from '../../components/ui/Dialog'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { LoadingState } from '../../components/ui/LoadingState'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { formatPHP } from '../../lib/format'
import { accountKey, defaultAccount, useShopSettings, useStoredValue } from '../../lib/preferences'
import type { CustomerAppointment, ServiceIntake, ServiceOffering } from '../../types'
import { availableWindows, slotLabel } from '../services/serviceCatalog'
import { ServiceOfferingDetails } from '../services/ServiceOfferingDetails'
import { selectedServiceCharges, serviceChargesTotal } from '../services/serviceCharges'
import { priceVisit } from '../services/visitPricing'
import { saveAppointment } from './customerOperations'
import { ServiceIntakeFields } from './ServiceIntakeFields'
import { ServiceIntakePrintRoot } from './ServiceIntakeDocument'
import { ServiceIntakePreview } from './ServiceIntakePreview'
import { emptyServiceIntake, intakeTypeForService, validateServiceIntake } from './serviceIntake'

export function BookingPage() {
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const [shop, , settingsStatus] = useShopSettings()
  const [profile] = useStoredValue(accountKey(user!.id), defaultAccount)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [detailService, setDetailService] = useState<ServiceOffering | null>(null)
  const [intakePreview, setIntakePreview] = useState<CustomerAppointment | null>(null)
  const service = shop.services.find((item) => item.id === serviceId)
  const [deviceFilter, setDeviceFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<'Workshop' | 'Home service' | null>(null)
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([])
  const selectedCharges = selectedServiceCharges(service, selectedChargeIds)
  const [device, setDevice] = useState('')
  const [specs, setSpecs] = useState('')
  const [unknown, setUnknown] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [intake, setIntake] = useState<ServiceIntake>({
    ...emptyServiceIntake,
    customerName: profile.name || user?.name || '',
    contactPhone: profile.phone,
  })
  const [intakeAcknowledged, setIntakeAcknowledged] = useState(false)
  const [addressChoice, setAddress] = useState<string | null>(null)
  const address = addressChoice ?? profile.address
  const [sent, setSent] = useState<CustomerAppointment | null>(null)
  const { busy, error, setError, run } = useAsyncAction()
  const slots = useLiveCollection<{ id: string; count: number }>(
    'appointmentSlots',
    !!date,
    [where('date', '==', date)],
    date,
  )
  const windows = availableWindows(date, shop.schedule, slots.rows, service?.durationMinutes)
  const scheduledWindows = availableWindows(date, shop.schedule, [], service?.durationMinutes)
  const available = service?.active && (mode === 'Home service' ? service.home : service.workshop)
  const visit =
    service && mode && available
      ? priceVisit(
          {
            service: service.name,
            serviceId: service.id,
            selectedCharges,
            visit: {
              mode,
              address: address || 'Address pending',
              distanceKm: 0,
              basePrice: null,
              surcharge: null,
              transport: null,
              taxRate: shop.taxRate,
              estimate: null,
            },
          },
          shop,
        )
      : null
  const offerings = shop.services.filter((item) => item.active)
  const filtered = offerings.filter(
    (item) =>
      (deviceFilter === 'All' || item.deviceType === deviceFilter) &&
      `${item.name} ${item.description} ${item.inclusions || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const reviewStep = 4
  const steps = ['Location & device', 'Schedule', 'Device intake', 'Review']
  function choose(item: ServiceOffering) {
    setServiceId(item.id)
    setSelectedChargeIds([])
    setSent(null)
    setIntakePreview(null)
    setStep(1)
    setError('')
    setIntake((current) => ({
      ...current,
      customerName: current.customerName || profile.name || user?.name || '',
      contactPhone: current.contactPhone || profile.phone,
      deviceType: item.deviceType === 'Laptop' ? 'Laptop' : 'Desktop PC',
      serviceType: intakeTypeForService(item.id, item.name),
    }))
    if (mode && !(mode === 'Workshop' ? item.workshop : item.home)) setMode(null)
  }
  function proceed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!mode || !available) {
      setError('Choose an available service location.')
      return
    }
    if (!device.trim() || (mode === 'Home service' && !address.trim())) {
      setError('Enter the device and home-service address before continuing.')
      return
    }
    if (
      step >= 2 &&
      (!date || date < today() || !windows.some((window) => slotLabel(window) === time))
    ) {
      setError('Choose an available date and time. Your previous slot may no longer be available.')
      return
    }
    if (step >= 3) {
      try {
        validateServiceIntake(intake)
      } catch (intakeError) {
        setError(intakeError instanceof Error ? intakeError.message : 'Complete the device intake.')
        return
      }
      if (!intakeAcknowledged) {
        setError('Confirm that the printed form will be reviewed and signed before work starts.')
        return
      }
    }
    if (step < reviewStep) {
      setStep(step + 1)
      return
    }
    void run(async () => {
      if (!service || !visit) throw new Error('Choose an available service.')
      if (
        !(await confirm({
          title: 'Send booking request?',
          message: `Request ${service.name} for ${date} at ${time}? JBC will review the appointment before confirming it.`,
          confirmLabel: 'Send request',
        }))
      )
        return
      const record = await saveAppointment(user!, {
        serviceId: service.id,
        service: `${service.name} / ${service.deviceType}`,
        device,
        specifications: unknown ? '' : specs,
        unknownSpecifications: unknown,
        preferredDate: date,
        preferredTime: time,
        notes,
        serviceIntake: intake,
        selectedCharges,
        visit: { ...visit, address: mode === 'Workshop' ? '' : address },
      })
      setSent(record)
      setServiceId(null)
      setMode(null)
      setDevice('')
      setSpecs('')
      setUnknown(false)
      setAddress(null)
      setDate('')
      setTime('')
      setNotes('')
      setSelectedChargeIds([])
      setIntake({
        ...emptyServiceIntake,
        customerName: profile.name || user?.name || '',
        contactPhone: profile.phone,
      })
      setIntakeAcknowledged(false)
    })
  }
  return (
    <>
      {sent && (
        <div className="booking-success" role="status">
          <Check />
          <div>
            <strong>Booking request received</strong>
            <p>Reference {sent.id} · Requested. No payment collected.</p>
          </div>
          {sent.serviceIntake && (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIntakePreview(sent)}
              >
                View authorization form
              </button>
              <button type="button" className="secondary-button" onClick={() => window.print()}>
                <Printer size={17} /> Print form
              </button>
            </>
          )}
          <Link
            className="secondary-button"
            to={`/customer/records?tab=appointments&reference=${encodeURIComponent(sent.id)}`}
          >
            View appointment
          </Link>
        </div>
      )}
      {sent?.serviceIntake && <ServiceIntakePrintRoot appointment={sent} />}
      {intakePreview && (
        <ServiceIntakePreview
          appointment={intakePreview}
          onClose={() => setIntakePreview(null)}
          onPrint={() => window.print()}
        />
      )}
      <section className="booking-intro jbc-blue-hero" aria-label="Services introduction">
        <div>
          <span className="eyebrow">PLAN YOUR VISIT</span>
          <h2>Choose the care your device needs.</h2>
          <p>
            Clear service estimates up front. JBC reviews your request before confirming a time.
          </p>
        </div>
      </section>
      <div className="service-catalog-tools discovery-card">
        <div className="service-catalog-heading">
          <div><span className="eyebrow">FIND A SERVICE</span><h2>Explore services</h2></div>
          <span className="discovery-card-count" role="status">
            {settingsStatus.loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'service' : 'services'}`}
          </span>
        </div>
        <div className="service-catalog-fields">
          <div className="service-device-filter">
          <span className="service-filter-label">Device type</span>
          <div className="record-tabs" role="group" aria-label="Device type">
            {['All', ...new Set(offerings.map((item) => item.deviceType))].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={deviceFilter === value}
                className={deviceFilter === value ? 'primary-button' : 'secondary-button'}
                onClick={() => setDeviceFilter(value)}
              >
                {value === 'All' ? 'All devices' : value}
              </button>
            ))}
          </div>
          </div>
          <label className="service-search">
          <span className="service-filter-label">Search</span>
          <span className="service-search-field">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search services"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </span>
          </label>
        </div>
      </div>
      {settingsStatus.error ? (
        <p className="form-error" role="alert">
          {settingsStatus.error}
        </p>
      ) : settingsStatus.loading ? (
        <LoadingState label="Loading services…" />
      ) : (
        <>
          <div className="booking-results-heading">
            <h2>Available services</h2>
          </div>
          <div className="service-grid">
            {filtered.map((item) => (
              <article className="service-price-card" key={item.id}>
                {item.image ? <img className="service-card-image" src={item.image} alt="" /> : <div className="service-card-icon" aria-hidden="true">
                  {item.deviceType === 'Laptop' ? <Laptop size={23} /> : <Monitor size={23} />}
                </div>}
                <div className="service-card-meta">
                  <span>{item.deviceType}</span>
                  <span>
                    <Clock3 size={15} />
                    {item.durationMinutes} min
                  </span>
                </div>
                <h2>{item.name}</h2>
                {item.description && <p>{item.description}</p>}
                {item.inclusions && <p className="service-inclusions">{item.inclusions}</p>}
                <div className="service-price">
                  <strong>
                    {item.price === '' ? 'Quote after review' : formatPHP(Number(item.price))}
                  </strong>
                  <small>Service estimate</small>
                </div>
                <p className="service-locations">
                  {[item.workshop && 'Workshop', item.home && 'Home service']
                    .filter(Boolean)
                    .join(' · ') || 'Contact JBC for availability'}
                </p>
                <button type="button" className="secondary-button service-view-details" onClick={() => setDetailService(item)}><Eye size={16} /> View details</button>
                <button
                  className="primary-button"
                  disabled={!item.home && !item.workshop}
                  onClick={() => choose(item)}
                >
                  Choose service
                  <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <div className="customer-empty">
              <CalendarDays />
              <p>
                {offerings.length
                  ? 'No services match your filters.'
                  : 'No services are published yet. Please check back.'}
              </p>
              {offerings.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery('')
                    setDeviceFilter('All')
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </>
      )}
      {detailService && <Dialog title={detailService.name} wide onClose={() => setDetailService(null)} footer={
        <button type="button" className="primary-button" onClick={() => { choose(detailService); setDetailService(null) }}>Choose service</button>
      }><ServiceOfferingDetails service={detailService} /></Dialog>}
      {serviceId && (
        <Dialog
          title={service?.name || 'Service unavailable'}
          wide
          onClose={() => {
            if (!busy) setServiceId(null)
          }}
          footer={
            <>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  if (step === 1) setServiceId(null)
                  else setStep(step - 1)
                  setError('')
                }}
              >
                <ArrowLeft size={17} />
                {step === 1 ? 'Change service' : 'Back'}
              </button>
              <button
                className="primary-button"
                form="customer-booking"
                type="submit"
                disabled={
                  busy || !service?.active || (step >= 2 && (slots.loading || !!slots.error))
                }
              >
                {step === reviewStep ? <Send size={17} /> : null}
                {busy ? 'Submitting…' : step === reviewStep ? 'Submit request' : 'Continue'}
                {step < reviewStep && <ArrowRight size={17} />}
              </button>
            </>
          }
        >
          <div className="booking-modal-summary">
            <span className="eyebrow">SERVICE REQUEST</span>
            <strong>
              {service?.deviceType} · {service?.durationMinutes} min
            </strong>
            <small>
              {mode && visit
                ? visit.estimate === null ? 'Final quote after review' : `${formatPHP(visit.estimate)} estimated total`
                : service?.price === '' ? 'Quote after review' : formatPHP(Number(service?.price)) + ' service estimate'}
            </small>
          </div>
          <ol
            className={`booking-steps booking-steps-${steps.length}`}
            aria-label="Booking progress"
          >
            {steps.map((label, index) => (
              <li
                key={label}
                aria-current={step === index + 1 ? 'step' : undefined}
                className={index + 1 < step ? 'is-complete' : ''}
              >
                <span>{index + 1 < step ? <Check size={15} /> : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <form
            id="customer-booking"
            className="portal-form settings-fields booking-modal-form"
            onSubmit={proceed}
            aria-busy={busy}
          >
            {!service?.active && (
              <p className="form-error" role="alert">
                This service is no longer available. Go back and choose another service.
              </p>
            )}
            {step === 1 && (
              <>
                <div className="booking-section-heading">
                  <span className="eyebrow">STEP 01 · THE VISIT</span>
                  <h3>Where should we work?</h3>
                  <p>
                    Choose how you’d like JBC to care for your {service?.deviceType.toLowerCase()}.
                  </p>
                </div>
                <div className="visit-options">
                  {service?.workshop && (
                    <button
                      type="button"
                      className="visit-option"
                      aria-pressed={mode === 'Workshop'}
                      onClick={() => setMode('Workshop')}
                    >
                      <MapPin />
                      <strong>Workshop</strong>
                      <span>Bring your device to JBC RigWorks.</span>
                    </button>
                  )}
                  {service?.home && (
                    <button
                      type="button"
                      className="visit-option"
                      aria-pressed={mode === 'Home service'}
                      onClick={() => setMode('Home service')}
                    >
                      <House />
                      <strong>Home service</strong>
                      <span>JBC visits your address. Transport fees need review.</span>
                    </button>
                  )}
                </div>
                <label>
                  Device brand / model
                  <input
                    required
                    maxLength={160}
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                    placeholder="Your device’s brand and model"
                  />
                </label>
                <label>
                  Known specifications (optional)
                  <input
                    disabled={unknown}
                    maxLength={500}
                    value={specs}
                    onChange={(e) => setSpecs(e.target.value)}
                  />
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={unknown}
                    onChange={(e) => setUnknown(e.target.checked)}
                  />
                  I’m not sure about my specifications
                </label>
                {mode === 'Home service' && (
                  <label>
                    Home-service address
                    <textarea
                      required
                      maxLength={400}
                      autoComplete="street-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Concerns or special requests
                  <textarea
                    rows={3}
                    maxLength={1000}
                    placeholder="Tell us what needs attention."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                {!!service?.additionalCharges?.length && (
                  <fieldset className="booking-additional-charges">
                    <legend>Optional additional work</legend>
                    <p>Choose any extras you want JBC to include in your request. The final quote is confirmed after review.</p>
                    {service.additionalCharges.map((charge) => (
                      <label className="check-row" key={charge.id}>
                        <input
                          type="checkbox"
                          checked={selectedChargeIds.includes(charge.id)}
                          onChange={(event) => {
                            const checked = event.target.checked
                            setSelectedChargeIds((current) => checked
                              ? current.includes(charge.id) ? current : [...current, charge.id]
                              : current.filter((id) => id !== charge.id))
                          }}
                        />
                        <span>{charge.name}</span>
                        <strong>{formatPHP(Number(charge.price))}</strong>
                      </label>
                    ))}
                    {!!selectedCharges.length && <p className="booking-additional-total" role="status">
                      Selected extras: {formatPHP(serviceChargesTotal(selectedCharges))}
                    </p>}
                  </fieldset>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <div className="booking-section-heading">
                  <span className="eyebrow">STEP 02 · SCHEDULE</span>
                  <h3>When works for you?</h3>
                  <p>
                    Available times are held as soon as you send the request. JBC still reviews and
                    confirms the service.
                  </p>
                </div>
                <div className="portal-form-grid">
                  <label>
                    Preferred date
                    <input
                      required
                      type="date"
                      min={today()}
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value)
                        setTime('')
                      }}
                    />
                  </label>
                  <label>
                    Preferred time
                    <select
                      required
                      disabled={!date || slots.loading}
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    >
                      <option value="">
                        {slots.loading ? 'Checking availability…' : 'Choose a time'}
                      </option>
                      {scheduledWindows.map((slot) => (
                        <option
                          key={slot.id}
                          value={slotLabel(slot)}
                          disabled={!windows.some((available) => available.id === slot.id)}
                        >
                          {slotLabel(slot)} ·{' '}
                          {windows.some((available) => available.id === slot.id)
                            ? 'Available'
                            : 'Booked'}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {date && !slots.loading && !slots.error && !windows.length && (
                  <p className="form-error">No available times on this date. Choose another day.</p>
                )}
                {date && !slots.loading && !slots.error && scheduledWindows.length > 0 && (
                  <p className="booking-availability-status" role="status">
                    {windows.length} available · {scheduledWindows.length - windows.length} booked
                  </p>
                )}
              </>
            )}
            {step === 3 && (
              <ServiceIntakeFields
                value={intake}
                onChange={setIntake}
                service={service?.name || ''}
                serviceId={service?.id}
                device={device}
                concerns={notes}
                acknowledged={intakeAcknowledged}
                onAcknowledge={setIntakeAcknowledged}
              />
            )}
            {step === reviewStep && (
              <>
                <div className="booking-section-heading">
                  <span className="eyebrow">FINAL STEP · REVIEW</span>
                  <h3>Review your request</h3>
                  <p>Check the visit details before sending them to JBC.</p>
                </div>
                <dl className="customer-detail-grid">
                  <div>
                    <dt>Service</dt>
                    <dd>{service?.name}</dd>
                  </div>
                  <div>
                    <dt>Device</dt>
                    <dd>
                      {device}
                      <small>{unknown ? 'Specifications unknown' : specs}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {mode}
                      {mode === 'Home service' && <small>{address}</small>}
                    </dd>
                  </div>
                  <div>
                    <dt>Preferred schedule</dt>
                    <dd>
                      {date}
                      <small>{time}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Contact email</dt>
                    <dd>{user?.email}</dd>
                  </div>
                  <div>
                    <dt>Concerns</dt>
                    <dd>{notes || 'None added'}</dd>
                  </div>
                  {!!selectedCharges.length && (
                    <div>
                      <dt>Requested extras</dt>
                      <dd>{selectedCharges.map((charge) => `${charge.name} (${formatPHP(charge.price)})`).join(', ')}</dd>
                    </div>
                  )}
                  <>
                    <div>
                      <dt>Intake contact</dt>
                      <dd>
                        {intake.customerName}
                        <small>{intake.contactPhone}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Device condition</dt>
                      <dd>
                        {intake.powerStatus}
                        <small>{intake.visibleCondition}</small>
                      </dd>
                    </div>
                    {intake.serviceType === 'general' && (
                      <div>
                        <dt>Reported history</dt>
                        <dd>
                          {intake.reportedIssues}
                          <small>{intake.issueHistory}</small>
                        </dd>
                      </div>
                    )}
                    {intake.serviceType === 'assembly' && (
                      <div>
                        <dt>Assembly plan</dt>
                        <dd>
                          {intake.assemblyGoal}
                          <small>{intake.assemblyParts}</small>
                        </dd>
                      </div>
                    )}
                    {intake.serviceType === 'diagnosis' && (
                      <div>
                        <dt>Diagnosis</dt>
                        <dd>
                          {intake.diagnosisSymptoms}
                          <small>{intake.issueHistory}</small>
                        </dd>
                      </div>
                    )}
                    {intake.serviceType === 'upgrade' && (
                      <div>
                        <dt>Upgrade plan</dt>
                        <dd>
                          {intake.upgradeTarget}
                          <small>{intake.upgradeCurrent}</small>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Data backup</dt>
                      <dd>{intake.backupStatus}</dd>
                    </div>
                  </>
                </dl>
                <dl className="checkout-totals">
                  <div>
                    <dt>Service estimate</dt>
                    <dd>
                      {visit?.basePrice == null ? 'Quote required' : formatPHP(visit.basePrice)}
                    </dd>
                  </div>
                  {!!selectedCharges.length && <div>
                    <dt>Selected extras</dt>
                    <dd>{formatPHP(serviceChargesTotal(selectedCharges))}</dd>
                  </div>}
                  {mode === 'Home service' && (
                    <>
                      <div>
                        <dt>Home-service fee</dt>
                        <dd>
                          {visit?.surcharge == null
                            ? 'To be confirmed'
                            : formatPHP(visit.surcharge)}
                        </dd>
                      </div>
                      <div>
                        <dt>Transportation</dt>
                        <dd>After address review</dd>
                      </div>
                    </>
                  )}
                  {shop.taxRate > 0 && (
                    <div>
                      <dt>Applicable tax</dt>
                      <dd>{shop.taxRate}%</dd>
                    </div>
                  )}
                  <div>
                    <dt>{visit?.estimate == null ? 'Final quote' : 'Estimated total'}</dt>
                    <dd>
                      {visit?.estimate == null ? 'After JBC review' : formatPHP(visit.estimate)}
                    </dd>
                  </div>
                </dl>
                <p className="fulfillment-note">
                  Your time is held when this request is sent. JBC will confirm the service details.
                  No payment is collected now.
                </p>
                <p className="home-intake-review-note">
                  The printed intake will be reviewed and signed with JBC before work begins.
                </p>
              </>
            )}
            {(error || slots.error || settingsStatus.error) && (
              <p className="form-error" role="alert">
                {error || slots.error || settingsStatus.error}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  )
}
