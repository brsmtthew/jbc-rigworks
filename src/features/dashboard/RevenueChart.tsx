import { useState } from 'react'
import { formatPHP } from '../../lib/format'
import type { Sale } from '../../types'

type DailyTotal = { day: number; date: string; revenue: number; received: number }
const chart = { width: 720, height: 236, left: 11, right: 11, top: 14, bottom: 28 }

function manilaDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
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
    Math.ceil(Math.max(...daily.map((item) => Math.max(item.revenue, item.received))) / 5000) * 5000,
  )
  const hasActivity = daily.some((item) => item.revenue > 0 || item.received > 0)
  const current = activeDay === null ? null : daily[activeDay]
  const monthLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long', year: 'numeric', timeZone: 'Asia/Manila',
  }).format(new Date(`${period}-01T12:00:00`))
  const plotHeight = chart.height - chart.top - chart.bottom
  const baseline = chart.height - chart.bottom
  const x = (index: number) =>
    chart.left + (index / Math.max(1, daily.length - 1)) * (chart.width - chart.left - chart.right)
  const y = (value: number) => chart.top + plotHeight * (1 - value / ceiling)
  const line = (key: 'revenue' | 'received') =>
    daily.map((entry, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(entry[key])}`).join(' ')
  const area = (key: 'revenue' | 'received') =>
    `${line(key)} L ${x(daily.length - 1)} ${baseline} L ${x(0)} ${baseline} Z`

  return (
    <div className="trend-chart">
      <div className="trend-chart-summary" aria-live="polite">
        <strong>{monthLabel}</strong>
        <span>{current ? `${current.date} · Sales ${formatPHP(current.revenue)} · Collections ${formatPHP(current.received)}` : hasActivity ? 'Focus or hover over a day to inspect its totals' : 'No sales or collections recorded this month'}</span>
      </div>
      <div className="trend-chart-plot">
        <div className="trend-chart-axis" aria-hidden="true">
          {[1, 0.5, 0].map((part) => <span key={part}>{formatPHP(ceiling * part, true)}</span>)}
        </div>
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="group" aria-label={`Daily sales and collections trend for ${monthLabel}`}>
          <defs>
            <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0867db" stopOpacity=".2" />
              <stop offset="100%" stopColor="#0867db" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="collections-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#168b72" stopOpacity=".16" />
              <stop offset="100%" stopColor="#168b72" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((part) => (
            <line key={part} x1="0" x2={chart.width} y1={y(ceiling * part)} y2={y(ceiling * part)} className="trend-gridline" />
          ))}
          {hasActivity && <>
            <path d={area('revenue')} fill="url(#sales-area)" />
            <path d={area('received')} fill="url(#collections-area)" />
            <path d={line('revenue')} className="trend-line trend-line-sales" />
            <path d={line('received')} className="trend-line trend-line-collections" />
          </>}
          {current && <>
            <line x1={x(activeDay!)} x2={x(activeDay!)} y1={chart.top} y2={baseline} className="trend-cursor" />
            <circle cx={x(activeDay!)} cy={y(current.revenue)} r="5" className="trend-point-sales" />
            <circle cx={x(activeDay!)} cy={y(current.received)} r="5" className="trend-point-collections" />
          </>}
          {daily.map((entry, index) => (
            <rect
              key={entry.date}
              x={x(index) - chart.width / daily.length / 2}
              y={chart.top}
              width={chart.width / daily.length}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              role="group"
              aria-label={`${entry.date}: sales ${formatPHP(entry.revenue)}, collections ${formatPHP(entry.received)}`}
              onFocus={() => setActiveDay(index)}
              onBlur={() => setActiveDay(null)}
              onMouseEnter={() => setActiveDay(index)}
              onMouseLeave={() => setActiveDay(null)}
            />
          ))}
        </svg>
      </div>
      <div className="trend-chart-ticks" aria-hidden="true">
        <span>1</span><span>{Math.round(daysInMonth / 4)}</span><span>{Math.round(daysInMonth / 2)}</span><span>{Math.round(daysInMonth * 3 / 4)}</span><span>{daysInMonth}</span>
      </div>
    </div>
  )
}
