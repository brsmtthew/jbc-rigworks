import { useState, type CSSProperties } from 'react'
import { formatPHP } from '../../lib/format'
import type { Sale } from '../../types'

type DailyTotal = { day: number; date: string; revenue: number; received: number }
function manilaDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(parsed)
}

export function RevenueChart({ sales, period }: { sales: Sale[]; period: string }) {
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const [year, month] = period.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const daily: DailyTotal[] = Array.from({ length: daysInMonth }, (_, index) => ({
    day: index + 1,
    date: `${period}-${String(index + 1).padStart(2, '0')}`,
    revenue: 0,
    received: 0,
  }))
  const byDate = new Map(daily.map((item) => [item.date, item]))
  for (const sale of sales) {
    const saleDay = byDate.get(sale.date)
    if (saleDay) saleDay.revenue += sale.total
    if (sale.paymentHistory?.length) {
      for (const payment of sale.paymentHistory) {
        const day = byDate.get(manilaDate(payment.date))
        if (day) day.received += payment.amount
      }
    } else {
      const legacyDay = byDate.get(sale.date)
      if (legacyDay) legacyDay.received += sale.paid
    }
  }
  const ceiling = Math.max(
    1000,
    Math.ceil(Math.max(...daily.map((item) => Math.max(item.revenue, item.received))) / 5000) *
      5000,
  )
  const hasActivity = daily.some((item) => item.revenue > 0 || item.received > 0)
  const current = activeDay === null ? null : daily[activeDay]
  const monthLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(`${period}-01T12:00:00`))
  return (
    <>
      <div className="daily-chart-summary" aria-live="polite">
        <strong>{monthLabel}</strong>
        <span>Each bar group represents one calendar day</span>
        {!hasActivity && <span>No sales for this period. Every calendar day is shown.</span>}
        {current && (
          <span className="daily-chart-active">
            <b>{current.date}</b> · Sales {formatPHP(current.revenue)} · Collections{' '}
            {formatPHP(current.received)}
          </span>
        )}
      </div>
      <div
        className="daily-chart-scroll"
        role="region"
        aria-label={`Daily sales and collections for ${monthLabel}`}
        tabIndex={0}
      >
        <div className="daily-chart-inner">
          <div className="daily-chart-y-axis" aria-hidden="true">
            {[4, 3, 2, 1, 0].map((part) => (
              <span key={part}>{formatPHP((ceiling * part) / 4, true)}</span>
            ))}
          </div>
          <div className="daily-chart-plot" style={{ '--day-count': daysInMonth } as CSSProperties}>
            <div className="daily-chart-grid" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((value) => (
                <i key={value} />
              ))}
            </div>
            {daily.map((entry, index) => (
              <div
                key={entry.date}
                className="daily-chart-day"
                tabIndex={0}
                role="group"
                aria-label={`${entry.date}: sales ${formatPHP(entry.revenue)}, collections ${formatPHP(entry.received)}`}
                onFocus={() => setActiveDay(index)}
                onBlur={() => setActiveDay(null)}
                onMouseEnter={() => setActiveDay(index)}
                onMouseLeave={() => setActiveDay(null)}
              >
                <div className="daily-chart-bars">
                  <span
                    className="daily-bar daily-bar-sales"
                    style={{
                      height: `${entry.revenue ? Math.max(2, (entry.revenue / ceiling) * 100) : 0}%`,
                    }}
                    title={`Sales ${formatPHP(entry.revenue)}`}
                  />
                  <span
                    className="daily-bar daily-bar-received"
                    style={{
                      height: `${entry.received ? Math.max(2, (entry.received / ceiling) * 100) : 0}%`,
                    }}
                    title={`Collections ${formatPHP(entry.received)}`}
                  />
                </div>
                <span className="daily-chart-day-label">{entry.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
