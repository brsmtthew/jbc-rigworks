import { useId, useState } from 'react'
import type { Sale } from '../../types/business'
import { formatPHP } from '../../data/appData'

export function RevenueChart({ sales }: { sales: Sale[] }) {
  const fillId = useId()
  const [active, setActive] = useState<number | null>(null)
  const byDate = new Map<string, { revenue: number; received: number }>()
  for (const sale of sales) {
    const current = byDate.get(sale.date) ?? { revenue: 0, received: 0 }
    byDate.set(sale.date, { revenue: current.revenue + sale.total, received: current.received + sale.paid })
  }
  const points: { date: string; revenue: number; received: number }[] = []
  for (const [date, value] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    const previous = points.at(-1)
    points.push({ date, revenue: (previous?.revenue ?? 0) + value.revenue, received: (previous?.received ?? 0) + value.received })
  }
  const ceiling = Math.max(1000, Math.ceil((points.at(-1)?.revenue ?? 0) / 5000) * 5000)
  const x = (index: number) => 20 + index * 700 / Math.max(1, points.length - 1)
  const y = (amount: number) => 205 - amount / ceiling * 180
  const line = (key: 'revenue' | 'received') => points.map((point, index) => `${index ? 'L' : 'M'}${x(index)} ${y(point[key])}`).join(' ')

  return <>
    <div className="chart-wrap">
      <div className="chart-y-axis" aria-hidden="true">{[1, 2 / 3, 1 / 3, 0].map(ratio => <span key={ratio}>₱{Math.round(ceiling * ratio / 1000)}k</span>)}</div>
      <div className="chart-canvas"><svg className="revenue-chart" viewBox="0 0 740 225" preserveAspectRatio="none" role="img" aria-label="Cumulative sales and payments in the selected period. Focus or hover over a point to read sales and collections.">
        <defs><linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--brand-blue)" stopOpacity=".17" /><stop offset="100%" stopColor="var(--brand-blue)" stopOpacity="0" /></linearGradient></defs>
        {[25, 85, 145, 205].map(value => <line key={value} x1="0" x2="740" y1={value} y2={value} className="chart-gridline" />)}
        {!!points.length && <path d={`${line('revenue')} L${x(points.length - 1)} 205 L20 205 Z`} fill={`url(#${fillId})`} />}
        <path d={line('revenue')} className="chart-line chart-line-primary" vectorEffect="non-scaling-stroke" />
        <path d={line('received')} className="chart-line chart-line-secondary" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => <g key={point.date} tabIndex={0} role="img" aria-label={point.date + ": Sales " + formatPHP(point.revenue) + ", collections " + formatPHP(point.received)} onFocus={() => setActive(index)} onMouseEnter={() => setActive(index)} onBlur={() => setActive(null)} onMouseLeave={() => setActive(null)}><title>{point.date + ": Sales " + formatPHP(point.revenue) + ", collections " + formatPHP(point.received)}</title><line x1={x(index)} x2={x(index)} y1="0" y2="225" stroke="transparent" strokeWidth="20"/><circle cx={x(index)} cy={y(point.revenue)} r="4" fill="var(--brand-blue)" /><circle cx={x(index)} cy={y(point.received)} r="3" fill="var(--teal)" /></g>)}
      </svg><div className="chart-labels">{points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 5)) === 0).map(point => <span key={point.date}>{new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(point.date + 'T12:00:00'))}</span>)}</div></div>
    </div>
    <div className="chart-readout" aria-live="polite">{active !== null && points[active] ? <><strong>{points[active].date}</strong><span>Sales {formatPHP(points[active].revenue)}</span><span>Collections {formatPHP(points[active].received)}</span></> : <span>{points.length ? "Hover or focus a point to inspect sales and collections." : "No sales for this period. The graph will update when sales are recorded."}</span>}</div>
  </>
}
