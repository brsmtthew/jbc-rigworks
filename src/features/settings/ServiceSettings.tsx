import { useState } from 'react'
import { useShopSettings } from '../../lib/preferences'
import { humanError } from '../../lib/workflow'
import type { ServiceOffering } from '../../types'

export function ServiceSettings({ scheduling = false }: { scheduling?: boolean }) {
  const [shop, saveShop] = useShopSettings()
  const [services, setServices] = useState(shop.services),
    [schedule, setSchedule] = useState(shop.schedule)
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('')
  const update = (id: string, values: Partial<ServiceOffering>) =>
    setServices((current) =>
      current.map((service) => (service.id === id ? { ...service, ...values } : service)),
    )
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
      if (sorted.some((slot, i) => i > 0 && slot.start < sorted[i - 1].end))
        throw new Error('Appointment windows cannot overlap.')
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
            Confirmed appointments count toward capacity. Changes apply to future confirmations;
            review existing appointments before blocking dates.
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
          <p>
            One catalog supplies customer bookings, workshop intake, and POS. Deactivate services to
            retain historical records.
          </p>
          {services.map((service) => (
            <details className="form-section" key={service.id}>
              <summary>
                {service.name} · {service.deviceType}
                {!service.active ? ' · Inactive' : ''}
              </summary>
              <div className="portal-form-grid">
                <label>
                  Service name
                  <input
                    value={service.name}
                    maxLength={100}
                    onChange={(e) => update(service.id, { name: e.target.value })}
                  />
                </label>
                <label>
                  Device type
                  <select
                    value={service.deviceType}
                    onChange={(e) =>
                      update(service.id, {
                        deviceType: e.target.value as ServiceOffering['deviceType'],
                      })
                    }
                  >
                    <option>Desktop</option>
                    <option>Laptop</option>
                    <option>Any</option>
                  </select>
                </label>
                <label>
                  Estimated price (PHP)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={service.price}
                    placeholder="Quote after review"
                    onChange={(e) => update(service.id, { price: e.target.value })}
                  />
                </label>
                <label>
                  Duration (minutes)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={service.durationMinutes}
                    onChange={(e) =>
                      update(service.id, { durationMinutes: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  value={service.description}
                  maxLength={1000}
                  onChange={(e) => update(service.id, { description: e.target.value })}
                />
              </label>
              <label>
                Package inclusions
                <textarea
                  value={service.inclusions}
                  maxLength={2000}
                  onChange={(e) => update(service.id, { inclusions: e.target.value })}
                />
              </label>
              {(['workshop', 'home', 'active'] as const).map((key) => (
                <label className="check-row" key={key}>
                  <input
                    type="checkbox"
                    checked={service[key]}
                    onChange={(e) => update(service.id, { [key]: e.target.checked })}
                  />
                  {
                    {
                      workshop: 'Workshop available',
                      home: 'Home service available',
                      active: 'Active',
                    }[key]
                  }
                </label>
              ))}
            </details>
          ))}
          <button
            className="secondary-button"
            onClick={() =>
              setServices([
                ...services,
                {
                  id: crypto.randomUUID(),
                  name: 'New service',
                  deviceType: 'Any',
                  description: '',
                  inclusions: '',
                  price: '',
                  durationMinutes: 60,
                  workshop: true,
                  home: false,
                  active: false,
                },
              ])
            }
          >
            Add service
          </button>
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
      <button className="primary-button" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  )
}
