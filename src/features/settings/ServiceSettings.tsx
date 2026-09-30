import { Clock3, House, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { formatPHP } from '../../lib/format'
import { useShopSettings } from '../../lib/preferences'
import { humanError } from '../../lib/workflow'
import type { ServiceOffering } from '../../types'

export function ServiceSettings({ scheduling = false }: { scheduling?: boolean }) {
  const { confirm } = useConfirmation()
  const [shop, saveShop] = useShopSettings()
  const [services, setServices] = useState(shop.services),
    [schedule, setSchedule] = useState(shop.schedule)
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('')
  const [editor, setEditor] = useState<ServiceOffering | null>(null)
  const [isNew, setIsNew] = useState(false)
  function beginAdd() {
    setEditor({
      id: crypto.randomUUID(), name: '', deviceType: 'Any', description: '', inclusions: '',
      price: '', durationMinutes: 60, workshop: true, home: false, active: true,
    })
    setIsNew(true)
    setError('')
  }
  function beginEdit(service: ServiceOffering) {
    setEditor({ ...service })
    setIsNew(false)
    setError('')
  }
  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || busy) return
    setError('')
    setMessage('')
    const service = { ...editor, name: editor.name.trim() }
    if (!service.name || !Number.isSafeInteger(service.durationMinutes) || service.durationMinutes < 1 ||
      (service.price !== '' && (!Number.isFinite(Number(service.price)) || Number(service.price) < 0)) ||
      (service.active && !service.workshop && !service.home)) {
      setError('Enter a name, valid price and duration, and at least one available location.')
      return
    }
    if (services.some((item) => item.id !== service.id && item.name.toLowerCase() === service.name.toLowerCase() && item.deviceType === service.deviceType)) {
      setError('A service with this name and device type already exists.')
      return
    }
    setBusy(true)
    try {
      const next = isNew ? [...services, service] : services.map((item) => item.id === service.id ? service : item)
      await saveShop({ ...shop, services: next })
      setServices(next)
      setEditor(null)
      setMessage(isNew ? 'Service added.' : 'Service updated.')
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }
  async function deleteService(service: ServiceOffering) {
    if (services.length === 1) {
      setError('Keep at least one service in the catalog. Deactivate it if bookings should stop.')
      return
    }
    if (busy || !(await confirm({
      title: 'Delete service?',
      message: `Remove ${service.name} / ${service.deviceType} from the catalog? Existing booking and sales records keep their saved details.`,
      confirmLabel: 'Delete service', tone: 'danger',
    }))) return
    setBusy(true)
    setError('')
    try {
      const next = services.filter((item) => item.id !== service.id)
      await saveShop({ ...shop, services: next })
      setServices(next)
      setMessage('Service deleted.')
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (
        services.some(
          (service) =>
            !service.name.trim() ||
            !Number.isFinite(service.durationMinutes) ||
            service.durationMinutes < 1 ||
            (service.price !== '' &&
              (!Number.isFinite(Number(service.price)) || Number(service.price) < 0)) ||
            (service.active && !service.workshop && !service.home),
        )
      )
        throw new Error('Check service names, prices, duration, and visit availability.')
      if (
        schedule.opens >= schedule.closes ||
        !schedule.days.length ||
        schedule.windows.some(
          (slot) =>
            !slot.start ||
            !slot.end ||
            slot.start >= slot.end ||
            slot.start < schedule.opens ||
            slot.end > schedule.closes ||
            !Number.isInteger(slot.capacity) ||
            slot.capacity < 1,
        )
      )
        throw new Error('Check opening hours, window times, and capacity.')
      const sorted = [...schedule.windows].sort((a, b) => a.start.localeCompare(b.start))
      if (
        !schedule.windows.length ||
        schedule.blockedDates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date)) ||
        schedule.blockedPeriods.some(
          (period) =>
            !/^\d{4}-\d{2}-\d{2}$/.test(period.date) ||
            !period.start ||
            !period.end ||
            period.start >= period.end,
        )
      )
        throw new Error('Add at least one appointment window and valid blocked dates or periods.')
      if (
        (schedule.dateOverrides ?? []).some(
          (override) =>
            !/^\d{4}-\d{2}-\d{2}$/.test(override.date) ||
            !schedule.windows.some((window) => window.id === override.windowId) ||
            !Number.isInteger(override.capacity) ||
            override.capacity < 0,
        )
      )
        throw new Error('Check the date-specific window capacities.')
      if (
        new Set(
          (schedule.dateOverrides ?? []).map((override) => `${override.date}_${override.windowId}`),
        ).size !== (schedule.dateOverrides ?? []).length
      )
        throw new Error('Each date and window can have only one capacity override.')
      if (sorted.some((slot, i) => i > 0 && slot.start < sorted[i - 1].end))
        throw new Error('Appointment windows cannot overlap.')
      if (
        scheduling &&
        !(await confirm({
          title: 'Save booking availability?',
          message:
            'Update operating days, time windows, and date-specific capacity for future bookings?',
          confirmLabel: 'Save availability',
        }))
      )
        return
      await saveShop({ ...shop, ...(scheduling ? { schedule } : { services }) })
      setMessage('Settings saved.')
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="portal-form settings-fields">
      {scheduling ? (
        <>
          <p>
            Requested and confirmed appointments reserve capacity. Set regular windows below, then
            adjust a specific date when technician availability changes.
          </p>
          <div className="schedule-days" role="group" aria-label="Operating days">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, day) => (
              <label className="check-row" key={name}>
                <input
                  type="checkbox"
                  checked={schedule.days.includes(day)}
                  onChange={(e) =>
                    setSchedule({
                      ...schedule,
                      days: e.target.checked
                        ? [...schedule.days, day]
                        : schedule.days.filter((value) => value !== day),
                    })
                  }
                />
                {name}
              </label>
            ))}
          </div>
          <div className="portal-form-grid">
            <label>
              Opening time
              <input
                type="time"
                value={schedule.opens}
                onChange={(e) => setSchedule({ ...schedule, opens: e.target.value })}
              />
            </label>
            <label>
              Closing time
              <input
                type="time"
                value={schedule.closes}
                onChange={(e) => setSchedule({ ...schedule, closes: e.target.value })}
              />
            </label>
          </div>
          {schedule.windows.map((slot, index) => (
            <div className="portal-form-grid schedule-window" key={slot.id}>
              <h3>Window {index + 1}</h3>
              <label>
                Window start
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) =>
                    setSchedule({
                      ...schedule,
                      windows: schedule.windows.map((value, i) =>
                        i === index ? { ...value, start: e.target.value } : value,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Window end
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) =>
                    setSchedule({
                      ...schedule,
                      windows: schedule.windows.map((value, i) =>
                        i === index ? { ...value, end: e.target.value } : value,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Capacity
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={slot.capacity}
                  onChange={(e) =>
                    setSchedule({
                      ...schedule,
                      windows: schedule.windows.map((value, i) =>
                        i === index ? { ...value, capacity: Number(e.target.value) } : value,
                      ),
                    })
                  }
                />
              </label>
              <button
                className="text-button"
                onClick={() =>
                  setSchedule({
                    ...schedule,
                    windows: schedule.windows.filter((value) => value.id !== slot.id),
                  })
                }
              >
                Remove window
              </button>
            </div>
          ))}
          <button
            className="secondary-button"
            onClick={() =>
              setSchedule({
                ...schedule,
                windows: [
                  ...schedule.windows,
                  { id: crypto.randomUUID(), start: '', end: '', capacity: 1 },
                ],
              })
            }
          >
            Add window
          </button>
          <h3>Date-specific availability</h3>
          <p>
            Set capacity to 0 to close one window on a date. The capacity is shared by workshop and
            home-service bookings.
          </p>
          {(schedule.dateOverrides ?? []).map((override, index) => (
            <div
              className="portal-form-grid schedule-window"
              key={`${override.date}_${override.windowId}_${index}`}
            >
              <label>
                Date
                <input
                  type="date"
                  value={override.date}
                  onChange={(e) =>
                    setSchedule({
                      ...schedule,
                      dateOverrides: (schedule.dateOverrides ?? []).map((value, i) =>
                        i === index ? { ...value, date: e.target.value } : value,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Window
                <select
                  value={override.windowId}
                  onChange={(e) =>
                    setSchedule({
                      ...schedule,
                      dateOverrides: (schedule.dateOverrides ?? []).map((value, i) =>
                        i === index ? { ...value, windowId: e.target.value } : value,
                      ),
                    })
                  }
                >
                  {schedule.windows.map((window) => (
                    <option key={window.id} value={window.id}>
                      {window.start}–{window.end}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Available bookings
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={override.capacity}
                  onChange={(e) =>
                    setSchedule({
                      ...schedule,
                      dateOverrides: (schedule.dateOverrides ?? []).map((value, i) =>
                        i === index ? { ...value, capacity: Number(e.target.value) } : value,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setSchedule({
                    ...schedule,
                    dateOverrides: (schedule.dateOverrides ?? []).filter((_, i) => i !== index),
                  })
                }
              >
                Remove date override
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setSchedule({
                ...schedule,
                dateOverrides: [
                  ...(schedule.dateOverrides ?? []),
                  { date: '', windowId: schedule.windows[0]?.id ?? '', capacity: 0 },
                ],
              })
            }
          >
            Add date override
          </button>
          <label>
            Blocked dates (one YYYY-MM-DD per line)
            <textarea
              rows={3}
              value={schedule.blockedDates.join('\n')}
              onChange={(e) =>
                setSchedule({
                  ...schedule,
                  blockedDates: e.target.value.split('\n').filter(Boolean),
                })
              }
            />
          </label>
          <h3>Blocked periods</h3>
          {schedule.blockedPeriods.map((period, index) => (
            <div key={index} className="portal-form-grid">
              {(['date', 'start', 'end'] as const).map((field) => (
                <label key={field}>
                  {field}
                  <input
                    type={field === 'date' ? 'date' : 'time'}
                    value={period[field]}
                    onChange={(e) =>
                      setSchedule({
                        ...schedule,
                        blockedPeriods: schedule.blockedPeriods.map((value, i) =>
                          i === index ? { ...value, [field]: e.target.value } : value,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <button
                className="text-button"
                onClick={() =>
                  setSchedule({
                    ...schedule,
                    blockedPeriods: schedule.blockedPeriods.filter((_, i) => i !== index),
                  })
                }
              >
                Remove block
              </button>
            </div>
          ))}
          <button
            className="secondary-button"
            onClick={() =>
              setSchedule({
                ...schedule,
                blockedPeriods: [...schedule.blockedPeriods, { date: '', start: '', end: '' }],
              })
            }
          >
            Block time period
          </button>
        </>
      ) : (
        <>
          <div className="service-catalog-toolbar">
            <p>Services here appear in customer bookings, workshop intake, and POS.</p>
            <button type="button" className="primary-button" onClick={beginAdd}>
              <Plus size={16} /> Add service
            </button>
          </div>
          <div className="service-catalog-grid">
            {services.map((service) => (
              <article className="service-catalog-card" key={service.id}>
                <div className="service-catalog-card-top">
                  <span>{service.deviceType}</span>
                  <small className={service.active ? 'is-active' : ''}>{service.active ? 'Active' : 'Inactive'}</small>
                </div>
                <h3>{service.name}</h3>
                <p>{service.description || 'No description added yet.'}</p>
                <div className="service-catalog-card-meta">
                  <strong>{service.price === '' ? 'Quote after review' : formatPHP(Number(service.price))}</strong>
                  <span><Clock3 size={14} /> {service.durationMinutes} min</span>
                </div>
                <div className="service-catalog-card-locations">
                  {service.workshop && <span><MapPin size={14} /> Workshop</span>}
                  {service.home && <span><House size={14} /> Home service</span>}
                </div>
                <div className="service-catalog-card-actions">
                  <button type="button" className="secondary-button" onClick={() => beginEdit(service)}>
                    <Pencil size={15} /> Edit
                  </button>
                  <button type="button" className="secondary-button is-danger" disabled={busy} onClick={() => void deleteService(service)}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!services.length && <p className="service-catalog-empty">No services yet. Add one to make it available in bookings and POS.</p>}
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="save-message">
          {message}
        </p>
      )}
      {scheduling && <button className="primary-button" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : 'Save availability'}
      </button>}
      {editor && (
        <Dialog title={isNew ? 'Add service' : 'Edit service'} onClose={() => !busy && setEditor(null)} footer={
          <>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy} form="service-catalog-editor">{busy ? 'Saving…' : isNew ? 'Add service' : 'Save service'}</button>
          </>
        }>
          <form id="service-catalog-editor" className="portal-form settings-fields service-catalog-editor" onSubmit={(event) => void saveService(event)}>
            <div className="portal-form-grid">
              <label>Service name<input required maxLength={100} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label>
              <label>Device type<select value={editor.deviceType} onChange={(event) => setEditor({ ...editor, deviceType: event.target.value as ServiceOffering['deviceType'] })}>
                <option>Desktop</option><option>Laptop</option><option>Any</option>
              </select></label>
              <label>Estimated price (PHP)<input type="number" min="0" step="0.01" placeholder="Quote after review" value={editor.price} onChange={(event) => setEditor({ ...editor, price: event.target.value })} /></label>
              <label>Duration (minutes)<input type="number" min="1" step="1" required value={editor.durationMinutes} onChange={(event) => setEditor({ ...editor, durationMinutes: Number(event.target.value) })} /></label>
            </div>
            <label>Description<textarea rows={3} maxLength={1000} value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} /></label>
            <label>Package inclusions<textarea rows={3} maxLength={2000} value={editor.inclusions} onChange={(event) => setEditor({ ...editor, inclusions: event.target.value })} /></label>
            <div className="service-catalog-editor-options">
              {(['workshop', 'home', 'active'] as const).map((key) => (
                <label className="check-row" key={key}><input type="checkbox" checked={editor[key]} onChange={(event) => setEditor({ ...editor, [key]: event.target.checked })} />{{ workshop: 'Workshop available', home: 'Home service available', active: 'Active in catalog' }[key]}</label>
              ))}
            </div>
            {error && <p role="alert" className="form-error">{error}</p>}
          </form>
        </Dialog>
      )}
    </div>
  )
}
