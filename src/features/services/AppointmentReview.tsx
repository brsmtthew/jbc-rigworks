import { where } from 'firebase/firestore'
import { useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { useLiveCollection } from '../../hooks/useLiveData'
import { useAuth } from '../../lib/auth-context'
import { today } from '../../lib/dates'
import { useShopSettings } from '../../lib/preferences'
import { humanError } from '../../lib/workflow'
import type { CustomerAppointment } from '../../types'
import { availableWindows, slotKey, slotLabel, type AppointmentSlot } from './serviceCatalog'
import { reviewAppointment } from './serviceOperations'

export function AppointmentReview({
  appointment,
  onClose,
  onSaved,
}: {
  appointment: CustomerAppointment
  onClose: () => void
  onSaved: () => void
}) {
  const { user } = useAuth(),
    [shop, , settings] = useShopSettings()
  const [date, setDate] = useState(appointment.preferredDate),
    [time, setTime] = useState(appointment.preferredTime)
  const [estimate, setEstimate] = useState(appointment.reviewedEstimate?.toString() ?? ''),
    [note, setNote] = useState('')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const slots = useLiveCollection<AppointmentSlot>(
    'appointmentSlots',
    !!date,
    [where('date', '==', date)],
    date,
  )
  const counts = slots.rows.map((slot) => ({
    ...slot,
    count: Math.max(
      0,
      slot.count - (appointment.slotId === slot.id && slot.holds?.[appointment.id] ? 1 : 0),
    ),
  }))
  const windows = availableWindows(
    date,
    shop.schedule,
    counts,
    shop.services.find((service) => service.id === appointment.serviceId)?.durationMinutes,
  )
  const unavailable = !windows.some((window) => slotLabel(window) === time)
  return (
    <Dialog
      title="Review appointment"
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <button className="secondary-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="submit"
            form="appointment-review"
            disabled={
              busy ||
              settings.loading ||
              slots.loading ||
              !!settings.error ||
              !!slots.error ||
              unavailable
            }
          >
            Save review
          </button>
        </>
      }
    >
      <form
        id="appointment-review"
        className="portal-form settings-fields"
        onSubmit={async (event) => {
          event.preventDefault()
          if (busy || !user) return
          setBusy(true)
          setError('')
          try {
            await reviewAppointment(user, appointment.id, {
              date,
              time,
              estimate: estimate.trim() === '' ? undefined : Number(estimate),
              note,
            })
            onSaved()
          } catch (err) {
            setError(humanError(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <h3>
          {appointment.service} / {appointment.customerName}
        </h3>
        <p>
          Confirm schedule changes with the customer. A confirmed appointment keeps its status and
          moves its capacity reservation.
        </p>
        <label>
          Date
          <input
            type="date"
            required
            min={today()}
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              setTime('')
            }}
          />
        </label>
        <label>
          Available window
          <select
            required
            value={unavailable ? '' : time}
            onChange={(event) => setTime(event.target.value)}
          >
            <option value="">Choose a window</option>
            {windows.map((window) => (
              <option key={slotKey(date, window.id)}>{slotLabel(window)}</option>
            ))}
          </select>
        </label>
        {!windows.length && !slots.loading && (
          <p>No available windows for this date. Choose another date.</p>
        )}
        <label>
          Reviewed estimate before tax (PHP)
          <input
            type="number"
            min="0"
            step="0.01"
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
            placeholder="Use the service estimate"
          />
        </label>
        <label>
          Review / schedule change note
          <textarea
            required
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <p>
          The estimate carries into service intake. The final service quote is confirmed before
          checkout. Include requested extras when entering a revised estimate.
        </p>
        {(error || settings.error || slots.error) && (
          <p role="alert" className="form-error">
            {error || settings.error || slots.error}
          </p>
        )}
      </form>
    </Dialog>
  )
}
