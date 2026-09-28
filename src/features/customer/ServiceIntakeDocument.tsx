import { createPortal } from 'react-dom'
import type { CustomerAppointment } from '../../types'
import { appointmentIntake, damageOptions, intakeTypeForService } from './serviceIntake'

const entry = (value?: string) => value?.trim() || '________________________'

export function ServiceIntakeDocument({ appointment }: { appointment: CustomerAppointment }) {
  const intake = appointmentIntake(appointment)
  const deviceType =
    intake?.deviceType ||
    (appointment.service.toLowerCase().includes('laptop') ? 'Laptop' : 'Desktop PC')
  const serviceType =
    intake?.serviceType ?? intakeTypeForService(appointment.serviceId, appointment.service)
  const field = (label: string, value?: string) => (
    <div className="home-intake-print-field" key={label}>
      <dt>{label}</dt>
      <dd>{entry(value)}</dd>
    </div>
  )
  return (
    <article
      className="home-intake-document"
      aria-label="Customer intake and service authorization form"
    >
      <header>
        <div>
          <span className="home-intake-print-kicker">
            JBC RIGWORKS · PC & LAPTOP CARE DONE RIGHT.
          </span>
          <h1>Customer intake & service authorization</h1>
          <p>Review the condition together and collect signatures before any service begins.</p>
        </div>
        <div className="home-intake-print-reference">
          <strong>Service Order # {appointment.id}</strong>
          <span>Date: ____________________</span>
          <span>Method: {appointment.visit?.mode ?? 'Workshop'}</span>
        </div>
      </header>
      <section>
        <h2>A. Customer information</h2>
        <dl className="home-intake-print-grid">
          {field('Customer name', intake?.customerName || appointment.customerName)}
          {field('Mobile number', intake?.contactPhone)}
          {field('Facebook / Instagram', intake?.socialHandle)}
          {field('Contact email', appointment.customerEmail)}
          {appointment.visit?.mode === 'Home service' &&
            field('Service address', appointment.visit.address)}
          {field(
            'Preferred date / time',
            `${appointment.preferredDate} · ${appointment.preferredTime}`,
          )}
        </dl>
      </section>
      <section>
        <h2>B. Device information</h2>
        <dl className="home-intake-print-grid">
          {field('Device', deviceType)}
          {field('Brand / model', appointment.device)}
          {field('Serial number / asset tag', intake?.serialNumber)}
          {field('CPU', intake?.cpu)}
          {field('GPU', intake?.gpu)}
          {field('RAM', intake?.ram)}
          {field('Storage', intake?.storage)}
          {deviceType === 'Desktop PC' ? (
            <>
              {field('Motherboard', intake?.motherboard)}
              {field('Power supply', intake?.psuOrCharger)}
              {field('Cooling', intake?.cooling)}
              {field('Case', intake?.desktopCase)}
            </>
          ) : (
            <>
              {field('Charger / adapter', intake?.psuOrCharger)}
              {field('Battery condition', intake?.laptopBattery)}
              {field('Display condition', intake?.laptopDisplay)}
            </>
          )}
          {field(
            'Other known specifications',
            appointment.unknownSpecifications ? 'Unknown' : appointment.specifications,
          )}
          {field('Accessories received / handled', intake?.accessories)}
        </dl>
      </section>
      <section>
        <h2>C. Requested service</h2>
        <dl className="home-intake-print-grid">
          {field('Approved service request', appointment.service)}
          {field('Customer concern / request', appointment.notes)}
          {serviceType === 'assembly' && (
            <>
              {field('Parts and supplier', intake?.assemblyParts)}
              {field('Intended PC use', intake?.assemblyGoal)}
              {field('OS / software setup', intake?.assemblyOs)}
            </>
          )}
          {serviceType === 'diagnosis' && (
            <>
              {field('Symptoms to diagnose', intake?.diagnosisSymptoms)}
              {field('Reproduction steps', intake?.diagnosisTriggers)}
              {field('Error message / code', intake?.diagnosisError)}
            </>
          )}
          {serviceType === 'upgrade' && (
            <>
              {field('Current hardware', intake?.upgradeCurrent)}
              {field('Desired upgrade', intake?.upgradeTarget)}
              {field('Replacement parts source', intake?.upgradePartsSource)}
            </>
          )}
        </dl>
        <div className="home-intake-write-line">Agreed service scope or limits:</div>
      </section>
      <section>
        <h2>D. Initial condition / existing issues</h2>
        <p className="home-intake-check-title">Visible condition</p>
        <div className="home-intake-checks">
          {damageOptions.map((option) => (
            <span key={option}>
              {intake?.visibleDamage?.includes(option) ? '☑' : '☐'} {option}
            </span>
          ))}
        </div>
        <dl className="home-intake-print-grid">
          {field('Other visible damage', intake?.otherDamage)}
          {field('Detailed visible condition', intake?.visibleCondition)}
          {field('Power status', intake?.powerStatus)}
          {field('Signs of liquid exposure', intake?.liquidExposure)}
          {serviceType === 'general' &&
            field('Existing hardware / performance issues', intake?.reportedIssues)}
          {(serviceType === 'general' || serviceType === 'diagnosis') &&
            field('Condition / issue history', intake?.issueHistory)}
          {serviceType !== 'assembly' &&
            field('Previous repairs or cleaning', intake?.previousRepairs)}
          {field('Important data backed up', intake?.backupStatus)}
        </dl>
      </section>
      <section className="home-intake-onsite">
        <h2>E. Before-service documentation · complete with customer</h2>
        <div className="home-intake-checks">
          <span>☐ Before-service photos taken</span>
          <span>☐ Device condition reviewed with customer</span>
          <span>☐ Device identity / serial checked</span>
          <span>☐ Accessories and power status checked</span>
        </div>
        <div className="home-intake-write-line">Photo / file reference (optional):</div>
        <div className="home-intake-write-line">
          Additional findings or differences from customer report:
        </div>
      </section>
      <section className="home-intake-agreement">
        <h2>F. Customer authorization</h2>
        <p>By signing, the customer confirms the following:</p>
        <ul className="home-intake-authorizations">
          <li>
            The device condition and existing issues have been documented to the best of JBC
            RigWorks’ ability.
          </li>
          <li>JBC RigWorks may perform only the service approved by the customer.</li>
          <li>Any additional work or charges require customer approval before proceeding.</li>
          <li>
            Existing hardware faults or damage may remain after service and may become apparent
            during testing.
          </li>
          <li>The customer is responsible for backing up important data before service.</li>
          <li>
            JBC RigWorks will not intentionally browse or access personal files unless required for
            an approved troubleshooting task and authorized by the customer.
          </li>
        </ul>
        <div className="home-intake-signatures">
          <div>
            <span className="home-intake-sign-line" />
            <strong>Customer signature</strong>
            <small>Printed name: {entry(intake?.customerName || appointment.customerName)}</small>
            <small>Date / time: ____________________</small>
          </div>
          <div>
            <span className="home-intake-sign-line" />
            <strong>JBC representative signature</strong>
            <small>Printed name: ____________________</small>
            <small>Date / time: ____________________</small>
          </div>
        </div>
      </section>
    </article>
  )
}

export function ServiceIntakePrintRoot({ appointment }: { appointment: CustomerAppointment }) {
  return createPortal(
    <div className="home-intake-print-root">
      <ServiceIntakeDocument appointment={appointment} />
    </div>,
    document.body,
  )
}
