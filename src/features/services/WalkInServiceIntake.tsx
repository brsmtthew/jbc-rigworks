import { ArrowLeft, ArrowRight, Check, Printer, Save, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '../../components/ui/Dialog'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { formatPHP } from '../../lib/format'
import { useShopSettings } from '../../lib/preferences'
import { humanError } from '../../lib/workflow'
import type { Job } from '../../types'
import { ServiceIntakeFields } from '../customer/ServiceIntakeFields'
import { ServiceIntakePrintRoot } from '../customer/ServiceIntakeDocument'
import { emptyServiceIntake, intakeTypeForService, validateServiceIntake } from '../customer/serviceIntake'
import { saveServiceJob } from './serviceOperations'
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
  const [device, setDevice] = useState('')
  const [due, setDue] = useState(today())
  const [quoteInput, setQuoteInput] = useState('')
  const [intake, setIntake] = useState({ ...emptyServiceIntake })
  const [saved, setSaved] = useState<Job | null>(null)
  const { busy, error, setError, run } = useAsyncAction()
  const offering = offerings.find((service) => service.id === serviceId)
  const quote = quoteInput.trim() ? Number(quoteInput) : 0
  const canPay = Number.isFinite(quote) && quote > 0

  function chooseService(id: string) {
    const selected = offerings.find((service) => service.id === id)
    setServiceId(id)
    setQuoteInput(selected?.price ?? '')
    if (selected)
      setIntake((current) => ({
        ...current,
        serviceType: intakeTypeForService(selected.id, selected.name),
        deviceType:
          selected.deviceType === 'Laptop'
            ? 'Laptop'
            : selected.deviceType === 'Desktop'
              ? 'Desktop PC'
              : current.deviceType,
      }))
    setError('')
  }

  function next() {
    try {
      if (stage === 0) {
        if (!offering) throw new Error('Choose an available workshop service.')
        if (!device.trim()) throw new Error('Enter the device brand and model.')
        if (!due || due < today()) throw new Error('Choose a current or future target date.')
        if (!Number.isFinite(quote) || quote < 0)
          throw new Error('Enter a valid service price before tax.')
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
        due,
        quote,
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
                <div><dt>Service price</dt><dd>{saved.quote > 0 ? formatPHP(saved.quote) : 'Pending quote'}</dd></div>
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
                  <div className="walkin-form-grid">
                    <label>
                      Workshop service
                      <select required value={serviceId} onChange={(event) => chooseService(event.target.value)}>
                        <option value="">Choose an available service</option>
                        {offerings.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name} / {service.deviceType}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Device brand / model
                      <input required maxLength={160} value={device} onChange={(event) => setDevice(event.target.value)} placeholder="e.g. Lenovo ThinkPad T14" />
                    </label>
                    <label>
                      Target completion date
                      <input type="date" required min={today()} value={due} onChange={(event) => setDue(event.target.value)} />
                    </label>
                    <label>
                      Approved service price before tax (PHP)
                      <input type="number" min="0" step="0.01" value={quoteInput} onChange={(event) => setQuoteInput(event.target.value)} placeholder={offering?.price === '' ? 'Quote after review' : '0.00'} />
                    </label>
                  </div>
                  {offering && (
                    <div className="walkin-service-selection">
                      <strong>{offering.name} · {offering.deviceType}</strong>
                      <p>{offering.description}</p>
                      <small>{offering.price === '' ? 'Price requires review before POS payment.' : `Catalog price ${formatPHP(Number(offering.price))} before tax.`}</small>
                    </div>
                  )}
                </div>
              )}
              {stage === 1 && offering && (
                <div className="walkin-intake-fields">
                  <ServiceIntakeFields
                    value={intake}
                    onChange={setIntake}
                    service={offering.name}
                    serviceId={offering.id}
                    device={device}
                    concerns={intake.reportedIssues || intake.diagnosisSymptoms || ''}
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
                    <div><dt>Device</dt><dd>{device}</dd></div>
                    <div><dt>Condition</dt><dd>{intake.visibleCondition}</dd></div>
                    <div><dt>Service price</dt><dd>{canPay ? formatPHP(quote) : 'Pending quote'}</dd></div>
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
      {printAppointment && <ServiceIntakePrintRoot appointment={printAppointment} walkIn />}
    </>
  )
}
