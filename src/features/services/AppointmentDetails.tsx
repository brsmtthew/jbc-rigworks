import { Dialog } from '../../components/ui/Dialog'
import { formatDate, formatPHP } from '../../lib/format'
import type { CustomerAppointment } from '../../types'
import { RecordStatus } from '../customer/RecordStatus'
import { appointmentIntake } from '../customer/serviceIntake'

export function AppointmentDetails({
  appointment,
  onClose,
}: {
  appointment: CustomerAppointment
  onClose: () => void
}) {
  const intake = appointmentIntake(appointment)
  const details = [
    ['Customer', appointment.customerName || 'Customer'],
    ['Email', appointment.customerEmail || 'Not recorded'],
    ['Device', appointment.device],
    ['Preferred visit', `${formatDate(appointment.preferredDate)} / ${appointment.preferredTime}`],
    ['Service location', appointment.visit?.mode ?? 'Workshop'],
    ...(appointment.selectedCharges?.length
      ? [[
          'Requested additional work',
          appointment.selectedCharges.map((charge) => `${charge.name} (${formatPHP(charge.price)})`).join(', '),
        ]]
      : []),
    ...(appointment.visit?.mode === 'Home service'
      ? [['Address', appointment.visit.address]]
      : []),
    ...(appointment.reviewedEstimate !== undefined
      ? [['Reviewed estimate', formatPHP(appointment.reviewedEstimate)]]
      : appointment.visit?.estimate !== null && appointment.visit?.estimate !== undefined
        ? [['Service estimate', formatPHP(appointment.visit.estimate)]]
        : []),
  ]

  return (
    <Dialog title="Appointment details" wide onClose={onClose}>
      <div className="admin-appointment-view">
        <div className="admin-appointment-view-heading">
          <div>
            <span className="eyebrow">SERVICE APPOINTMENT</span>
            <h3>{appointment.service}</h3>
            <small>{appointment.id}</small>
          </div>
          <RecordStatus status={appointment.status} />
        </div>
        <dl className="admin-appointment-view-grid">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {(appointment.notes || appointment.reviewNote) && (
          <section className="admin-appointment-view-section">
            <h4>Service details</h4>
            {appointment.notes && <p><strong>Reported concern:</strong> {appointment.notes}</p>}
            {appointment.reviewNote && <p><strong>Workshop review:</strong> {appointment.reviewNote}</p>}
          </section>
        )}
        {intake && (
          <section className="admin-appointment-view-section">
            <h4>Device intake</h4>
            <dl className="admin-appointment-view-grid">
              <div><dt>Power status</dt><dd>{intake.powerStatus || 'Not recorded'}</dd></div>
              <div><dt>Visible condition</dt><dd>{intake.visibleCondition || 'Not recorded'}</dd></div>
              {intake.issueHistory && <div><dt>Condition history</dt><dd>{intake.issueHistory}</dd></div>}
              {intake.accessories && <div><dt>Accessories</dt><dd>{intake.accessories}</dd></div>}
            </dl>
          </section>
        )}
        {(appointment.cancelledAt || appointment.cancellationReason) && (
          <section className="admin-appointment-view-section">
            <h4>Cancellation</h4>
            {appointment.cancelledAt && <p>Recorded {formatDate(appointment.cancelledAt.slice(0, 10))}</p>}
            {appointment.cancellationReason && <p>{appointment.cancellationReason}</p>}
          </section>
        )}
      </div>
    </Dialog>
  )
}
