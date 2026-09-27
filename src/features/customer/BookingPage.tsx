import { where } from 'firebase/firestore'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  House,
  MapPin,
  Send,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from '../../components/ui/Dialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { formatPHP } from '../../lib/format'
import { accountKey, defaultAccount, useShopSettings, useStoredValue } from '../../lib/preferences'
import type { ServiceOffering } from '../../types'
import { availableWindows, slotLabel } from '../services/serviceCatalog'
import { priceVisit } from '../services/visitPricing'
import { saveAppointment } from './customerOperations'

export function BookingPage() {
  const { user } = useAuth()
  const [shop, , settingsStatus] = useShopSettings()
  const [profile] = useStoredValue(accountKey(user!.id), defaultAccount)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const service = shop.services.find((item) => item.id === serviceId)
  const [deviceFilter, setDeviceFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<'Workshop' | 'Home service' | null>(null)
  const [device, setDevice] = useState('')
  const [specs, setSpecs] = useState('')
  const [unknown, setUnknown] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [addressChoice, setAddress] = useState<string | null>(null)
  const address = addressChoice ?? profile.address
  const [sent, setSent] = useState('')
  const { busy, error, setError, run } = useAsyncAction()
  const slots = useLiveCollection<{ id: string; count: number }>(
    'appointmentSlots',
    !!date,
    [where('date', '==', date)],
    date,
  )
  const windows = availableWindows(date, shop.schedule, slots.rows, service?.durationMinutes)
  const available = service?.active && (mode === 'Home service' ? service.home : service.workshop)
  const visit =
    service && mode && available
      ? priceVisit(
          {
            service: service.name,
            serviceId: service.id,
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
  function choose(item: ServiceOffering) {
    setServiceId(item.id)
    setSent('')
    setStep(1)
    setError('')
    if (mode && !(mode === 'Workshop' ? item.workshop : item.home)) setMode(null)
  }
  function proceed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!mode || !available) {
      setError('Choose an available service location.')
      return
    }
    if (
      step >= 2 &&
      (!date || date < today() || !windows.some((window) => slotLabel(window) === time))
    ) {
      setError('Choose an available date and time. Your previous slot may no longer be available.')
      return
    }
    if (step < 3) {
      setStep(step + 1)
      return
    }
    void run(async () => {
      if (!service || !visit) throw new Error('Choose an available service.')
      const record = await saveAppointment(user!, {
        serviceId: service.id,
        service: `${service.name} / ${service.deviceType}`,
        device,
        specifications: unknown ? '' : specs,
        unknownSpecifications: unknown,
        preferredDate: date,
        preferredTime: time,
        notes,
        visit: { ...visit, address: mode === 'Workshop' ? '' : address },
      })
      setSent(record.id)
      setServiceId(null)
      setDate('')
      setTime('')
      setNotes('')
    })
  }
  return (
    <>
      <PageHeader
        eyebrow="CARE FOR YOUR DEVICE"
        title="Services & booking"
        description="Choose a service. We’ll review the details and confirm your appointment."
      />
      {sent && (
        <div className="booking-success" role="status">
          <Check />
          <div>
            <strong>Booking request received</strong>
            <p>Reference {sent} · Requested. No payment collected.</p>
          </div>
          <Link
            className="secondary-button"
            to={`/customer/records?tab=appointments&reference=${encodeURIComponent(sent)}`}
          >
            View appointment
          </Link>
        </div>
      )}
      <div className="service-catalog-tools">
        <div className="record-tabs" role="group" aria-label="Device type">
          {['All', ...new Set(offerings.map((item) => item.deviceType))].map((value) => (
            <button
              key={value}
              aria-pressed={deviceFilter === value}
              className={deviceFilter === value ? 'primary-button' : 'secondary-button'}
              onClick={() => setDeviceFilter(value)}
            >
              {value === 'All' ? 'All devices' : value}
            </button>
          ))}
        </div>
        <label>
          Find a service
          <input
            type="search"
            placeholder="Search services"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {settingsStatus.error ? (
        <p className="form-error" role="alert">
          {settingsStatus.error}
        </p>
      ) : settingsStatus.loading ? (
        <div className="skeleton-grid" role="status" aria-label="Loading services">
          <i />
          <i />
          <i />
        </div>
      ) : (
        <>
          <div className="service-grid">
            {filtered.map((item) => (
              <article className="service-price-card" key={item.id}>
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
                {step === 3 ? <Send size={17} /> : null}
                {busy ? 'Submitting…' : step === 3 ? 'Submit booking request' : 'Continue'}
                {step < 3 && <ArrowRight size={17} />}
              </button>
            </>
          }
        >
          <ol className="booking-steps" aria-label="Booking progress">
            {['Service', 'Location & device', 'Schedule', 'Review'].map((label, index) => (
              <li
                key={label}
                aria-current={step === index ? 'step' : undefined}
                className={index < step ? 'is-complete' : ''}
              >
                <span>{index < step ? <Check size={15} /> : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <form
            id="customer-booking"
            className="portal-form settings-fields"
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
                <p>
                  Choose how you’d like JBC to care for your {service?.deviceType.toLowerCase()}.
                </p>
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
              </>
            )}
            {step === 2 && (
              <>
                <h3>When works for you?</h3>
                <p>Your preferred time is a request until JBC confirms it.</p>
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
                      {windows.map((slot) => (
                        <option key={slot.id}>{slotLabel(slot)}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {date && !slots.loading && !slots.error && !windows.length && (
                  <p className="form-error">No available times on this date. Choose another day.</p>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <h3>Review your request</h3>
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
                </dl>
                <dl className="checkout-totals">
                  <div>
                    <dt>Service estimate</dt>
                    <dd>
                      {visit?.basePrice == null ? 'Quote required' : formatPHP(visit.basePrice)}
                    </dd>
                  </div>
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
                  Your time is a request until JBC confirms. No payment is collected now.
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
