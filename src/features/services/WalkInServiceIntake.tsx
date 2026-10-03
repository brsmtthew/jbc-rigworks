import { ArrowLeft, ArrowRight, Check, Printer, Save, Search, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '../../components/ui/Dialog'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import { money } from '../../lib/commerce'
import { today } from '../../lib/dates'
import { formatPHP } from '../../lib/format'
import { useShopSettings } from '../../lib/preferences'
import { humanError } from '../../lib/workflow'
import type { Job } from '../../types'
import { ServiceIntakeFields } from '../customer/ServiceIntakeFields'
import { ServiceIntakePrintRoot } from '../customer/ServiceIntakeDocument'
import { emptyServiceIntake, intakeDeviceTypeForOffering, intakeTypeForService, validateServiceIntake } from '../customer/serviceIntake'
import { saveServiceJob } from './serviceOperations'
import { selectedServiceCharges, serviceChargesTotal } from './serviceCharges'
import { walkInDocumentAppointment } from './walkInDocument'
import { createWalkInJob } from './walkInJob'

const stages = ['Service & device', 'Device intake', 'Review & save']

export function WalkInServiceIntake({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [shop] = useShopSettings()
  const offerings = shop.services.filter((service) => service.active && service.workshop)
  const [stage, setStage] = useState(0)
  const [serviceId, setServiceId] = useState('')
  const [servicePickerOpen, setServicePickerOpen] = useState(false)
  const [serviceSearch, setServiceSearch] = useState('')
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([])
  const [device, setDevice] = useState('')
  const [concern, setConcern] = useState('')
  const [intake, setIntake] = useState({ ...emptyServiceIntake })
  const [saved, setSaved] = useState<Job | null>(null)
  const { busy, error, setError, run } = useAsyncAction()
  const offering = offerings.find((service) => service.id === serviceId)
  const matchingOfferings = offerings.filter((service) =>
    `${service.name} ${service.deviceType} ${service.description}`
      .toLowerCase()
      .includes(serviceSearch.trim().toLowerCase()),
  )
  const selectedCharges = selectedServiceCharges(offering, selectedChargeIds)
  const extrasTotal = serviceChargesTotal(selectedCharges)
  const basePrice = offering && offering.price !== '' ? Number(offering.price) : null
  const quote = basePrice === null ? 0 : money(basePrice + extrasTotal)
  const canPay = basePrice !== null && Number.isFinite(quote) && quote > 0

  function chooseService(id: string) {
    const selected = offerings.find((service) => service.id === id)
    setServiceId(id)
    setSelectedChargeIds([])
    if (selected)
      setIntake((current) => ({
        ...current,
        serviceType: intakeTypeForService(selected.id, selected.name),
        deviceType: intakeDeviceTypeForOffering(selected.deviceType) ?? current.deviceType,
      }))
    setError('')
    setServicePickerOpen(false)
  }

  function openServicePicker() {
    setServiceSearch('')
    setServicePickerOpen(true)
  }

  function next() {
    try {
      if (stage === 0) {
        if (!offering) {
          openServicePicker()
          return
        }
        if (!device.trim()) throw new Error('Enter the device brand and model.')
      } else if (stage === 1) {
        validateServiceIntake(intake)
      }
      setError('')
      setStage((current) => Math.min(2, current + 1))
    } catch (cause) {
      setError(humanError(cause))
    }
  }

  function save(openPos: boolean) {
    void run(async () => {
      if (!user || !offering) throw new Error('Choose an available workshop service.')
      const record = createWalkInJob({
        id: `JOB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        offering,
        intake,
        device,
        due: today(),
        quote,
        selectedCharges,
        concern,
        confirmedAt: new Date().toISOString(),
      })
      if (openPos && record.quote <= 0)
        throw new Error('Enter an approved service price before opening POS.')
      await saveServiceJob(user, record)
      if (openPos) {
        onClose()
        navigate('/pos', { state: { job: record } })
      } else {
        setSaved(record)
      }
    })
  }

  const close = () => {
    if (!busy) onClose()
  }
  const printAppointment = saved ? walkInDocumentAppointment(saved) : null

  return (
    <>
      <Dialog
        title={saved ? 'Walk-in intake saved' : 'New walk-in service'}
        wide
        onClose={close}
        footer={
          saved ? (
            <>
              <button type="button" className="secondary-button" onClick={() => window.print()}>
                <Printer size={16} /> Print authorization
              </button>
              <button type="button" className="secondary-button" onClick={close}>Back to Services</button>
              <button
                type="button"
                className="primary-button"
                disabled={saved.quote <= 0}
                onClick={() => {
                  onClose()
                  navigate('/pos', { state: { job: saved } })
                }}
              >
                <ShoppingCart size={16} /> Open POS to pay
              </button>
            </>
          ) : (
            <>
              <button type="button" className="secondary-button" onClick={stage === 0 ? close : () => {
                setError('')
                setStage(stage - 1)
              }} disabled={busy}>
                {stage === 0 ? 'Cancel' : <><ArrowLeft size={16} /> Back</>}
              </button>
              {stage < 2 ? (
                <button type="button" className="primary-button" onClick={next} disabled={busy}>
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button type="button" className="secondary-button" onClick={() => save(false)} disabled={busy}>
                    <Save size={16} /> Save walk-in intake
                  </button>
                  <button type="button" className="primary-button" onClick={() => save(true)} disabled={busy || !canPay}>
                    <ShoppingCart size={16} /> Save &amp; open POS
                  </button>
                </>
              )}
            </>
          )
        }
      >
        <div className="walkin-form">
          {saved ? (
            <div className="walkin-success">
              <span className="walkin-success-icon"><Check size={25} /></span>
              <span className="eyebrow">WALK-IN · AUTOMATICALLY CONFIRMED</span>
              <h3>{saved.service}</h3>
              <p>
                {saved.customer} and the device intake are saved as a checked-in walk-in service.
                Print the authorization and collect both signatures before work begins.
              </p>
              <dl>
                <div><dt>Device</dt><dd>{saved.device}</dd></div>
                <div><dt>Service total before tax</dt><dd>{saved.quote > 0 ? formatPHP(saved.quote) : 'Pending quote'}</dd></div>
                {!!saved.selectedCharges?.length && <div><dt>Additional work</dt><dd>{saved.selectedCharges.map((charge) => charge.name).join(', ')}</dd></div>}
                <div><dt>Reference</dt><dd>{saved.id}</dd></div>
              </dl>
              {saved.quote <= 0 && <p className="walkin-price-note">Enter an approved price in the service record before taking payment in POS.</p>}
            </div>
          ) : (
            <>
              <div className="walkin-steps" aria-label="Walk-in intake progress">
                {stages.map((label, index) => (
                  <div className={index === stage ? 'is-current' : index < stage ? 'is-done' : ''} key={label}>
                    <span>{index < stage ? <Check size={14} /> : index + 1}</span>
                    {label}
                  </div>
                ))}
              </div>
              <div className="walkin-form-intro">
                <span className="eyebrow">WALK-IN CUSTOMER · NO APPOINTMENT NEEDED</span>
                <h3>{stages[stage]}</h3>
                <p>Talk through the service and document the device before starting work.</p>
              </div>
              {stage === 0 && (
                <div className="walkin-form-section">
                  <div className="walkin-service-picker-row">
                    <div>
                      <strong>Workshop service</strong>
                      <p>Choose the service that matches the customer's device. Record their concerns in the intake.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={openServicePicker} disabled={!offerings.length}>
                      {offering ? 'Change service' : 'Choose service'} <ArrowRight size={16} />
                    </button>
                  </div>
                  {offering ? (
                    <div className="walkin-service-selection">
                      <div>
                        <strong>{offering.name}</strong>
                        <small>{offering.deviceType} · {offering.durationMinutes} min</small>
                      </div>
                      <b>{offering.price === '' ? 'Quote after review' : formatPHP(Number(offering.price))}</b>
                      {offering.description && <p>{offering.description}</p>}
                    </div>
                  ) : (
                    <p className="walkin-service-empty">
                      {offerings.length ? 'No service selected yet.' : 'No active workshop services are available. Add one in Services settings.'}
                    </p>
                  )}
                  {!!offering?.additionalCharges?.length && (
                    <fieldset className="walkin-additional-charges">
                      <legend>Optional additional work</legend>
                      <p>Select work the customer requests. These charges are included in the service total.</p>
                      <div className="walkin-additional-options">
                        {offering.additionalCharges.map((charge) => (
                          <label className="walkin-additional-option" key={charge.id}>
                            <input
                              type="checkbox"
                              checked={selectedChargeIds.includes(charge.id)}
                              onChange={(event) => setSelectedChargeIds((current) =>
                                event.target.checked
                                  ? [...current, charge.id]
                                  : current.filter((id) => id !== charge.id),
                              )}
                            />
                            <span>{charge.name}</span>
                            <strong>{formatPHP(Number(charge.price))}</strong>
                          </label>
                        ))}
                      </div>
                      <p className="walkin-additional-total" role="status">
                        {selectedCharges.length} selected · {formatPHP(extrasTotal)} additional
                        {basePrice !== null && ` · ${formatPHP(quote)} service total before tax`}
                      </p>
                    </fieldset>
                  )}
                  <div className="walkin-form-grid">
                    <label>
                      Device brand / model
                      <input required maxLength={160} value={device} onChange={(event) => setDevice(event.target.value)} placeholder="e.g. Lenovo ThinkPad T14" />
                    </label>
                  </div>
                </div>
              )}
              {stage === 1 && offering && (
                <div className="walkin-intake-fields">
                  <ServiceIntakeFields
                    value={intake}
                    onChange={setIntake}
                    service={offering.name}
                    serviceId={offering.id}
                    serviceDeviceType={offering.deviceType}
                    device={device}
                    concerns={concern}
                    onConcernsChange={setConcern}
                    acknowledged={false}
                    onAcknowledge={() => {}}
                    editing
                    walkIn
                  />
                </div>
              )}
              {stage === 2 && offering && (
                <div className="walkin-review">
                  <div className="walkin-review-banner">
                    <Check size={19} /> This walk-in will be confirmed and checked in when saved. No online appointment approval is needed.
                  </div>
                  <dl>
                    <div><dt>Customer</dt><dd>{intake.customerName}</dd></div>
                    <div><dt>Phone</dt><dd>{intake.contactPhone}</dd></div>
                    <div><dt>Service</dt><dd>{offering.name} / {offering.deviceType}</dd></div>
                    <div><dt>Customer concern / request</dt><dd>{concern || 'None added'}</dd></div>
                    {!!selectedCharges.length && <div><dt>Additional work</dt><dd>{selectedCharges.map((charge) => `${charge.name} (${formatPHP(charge.price)})`).join(', ')}</dd></div>}
                    <div><dt>Device</dt><dd>{device}</dd></div>
                    <div><dt>Condition</dt><dd>{intake.visibleCondition}</dd></div>
                    <div><dt>Service total before tax</dt><dd>{canPay ? formatPHP(quote) : 'Pending quote'}</dd></div>
                  </dl>
                  <p>Print the saved intake and service authorization. The customer and JBC representative sign it before work begins.</p>
                  {!canPay && <p className="walkin-price-note">Add an approved price to enable the POS payment button.</p>}
                </div>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
            </>
          )}
        </div>
      </Dialog>
      {servicePickerOpen && (
        <Dialog title="Choose workshop service" wide onClose={() => setServicePickerOpen(false)}>
          <div className="walkin-service-picker">
            <p>Search the workshop catalog and select one service for this device.</p>
            <label className="walkin-service-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search workshop services</span>
              <input
                autoFocus
                type="search"
                value={serviceSearch}
                onChange={(event) => setServiceSearch(event.target.value)}
                placeholder="Search services or device types"
              />
            </label>
            <span className="walkin-service-count" role="status">
              {matchingOfferings.length} {matchingOfferings.length === 1 ? 'service' : 'services'} available
            </span>
            <div className="walkin-service-options">
              {matchingOfferings.map((service) => (
                <button
                  type="button"
                  key={service.id}
                  className={serviceId === service.id ? 'walkin-service-option is-selected' : 'walkin-service-option'}
                  aria-pressed={serviceId === service.id}
                  onClick={() => chooseService(service.id)}
                >
                  <span><strong>{service.name}</strong><small>{service.deviceType} · {service.durationMinutes} min</small></span>
                  <b>{service.price === '' ? 'Quote after review' : formatPHP(Number(service.price))}</b>
                </button>
              ))}
              {!matchingOfferings.length && <p className="walkin-service-no-results">No matching services. Try another name or device type.</p>}
            </div>
          </div>
        </Dialog>
      )}
      {printAppointment && <ServiceIntakePrintRoot appointment={printAppointment} walkIn />}
    </>
  )
}
