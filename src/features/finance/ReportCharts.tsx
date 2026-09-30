import { useId, type ReactNode } from 'react'
import { reportColors } from './reportChartColors'

export type ReportDatum = { label: string; value: number; color?: string }

const positive = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0)
const totalOf = (items: ReportDatum[]) => items.reduce((sum, item) => sum + positive(item.value), 0)

export function ReportCard({
  kicker,
  title,
  description,
  tone = 'blue',
  children,
  className = '',
}: {
  kicker: string
  title: string
  description: string
  tone?: 'blue' | 'teal' | 'violet' | 'amber' | 'green'
  children: ReactNode
  className?: string
}) {
  const titleId = useId()
  return (
    <section className={`report-viz-card report-viz-card-${tone} ${className}`} aria-labelledby={titleId}>
      <header className="report-viz-header">
        <span className="report-viz-kicker">{kicker}</span>
        <h3 id={titleId}>{title}</h3>
        <p>{description}</p>
      </header>
      <div className="report-viz-body">{children}</div>
    </section>
  )
}

export function DonutChart({
  items,
  centerLabel,
  centerValue,
  formatValue = String,
}: {
  items: ReportDatum[]
  centerLabel: string
  centerValue: string | number
  formatValue?: (value: number) => string
}) {
  const total = totalOf(items)
  let offset = 0
  const segments = items.map((item, index) => {
    const start = offset
    offset += (positive(item.value) / (total || 1)) * 100
    return `${item.color || reportColors[index % reportColors.length]} ${start}% ${offset}%`
  })
  return (
    <div className="report-donut-layout">
      <div
        className="report-donut"
        style={{ background: total ? `conic-gradient(${segments.join(', ')})` : '#e9f0f8' }}
        aria-hidden="true"
      >
        <div className="report-donut-center">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="report-donut-legend">
        {items.map((item, index) => (
          <li key={item.label}>
            <i style={{ background: item.color || reportColors[index % reportColors.length] }} />
            <span>{item.label}</span>
            <strong>{formatValue(item.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RankedBars({
  items,
  formatValue = String,
  emptyMessage,
}: {
  items: ReportDatum[]
  formatValue?: (value: number) => string
  emptyMessage: string
}) {
  if (!items.length) return <p className="report-viz-empty">{emptyMessage}</p>
  const max = Math.max(1, ...items.map((item) => positive(item.value)))
  return (
    <div className="report-ranked-bars">
      {items.map((item, index) => (
        <div className="report-ranked-row" key={item.label}>
          <div className="report-ranked-label">
            <span>{item.label}</span>
            <strong>{formatValue(item.value)}</strong>
          </div>
          <div className="report-ranked-track" aria-hidden="true">
            <span
              style={{
                width: `${(positive(item.value) / max) * 100}%`,
                background: item.color || reportColors[index % reportColors.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ColumnChart({
  items,
  formatValue = String,
  emptyMessage,
}: {
  items: ReportDatum[]
  formatValue?: (value: number) => string
  emptyMessage: string
}) {
  if (!items.length || !totalOf(items)) return <p className="report-viz-empty">{emptyMessage}</p>
  const max = Math.max(1, ...items.map((item) => positive(item.value)))
  return (
    <div className="report-columns">
      {items.map((item, index) => (
        <div className="report-column" key={item.label}>
          <strong>{formatValue(item.value)}</strong>
          <div className="report-column-track" aria-hidden="true">
            <span
              style={{
                height: `${(positive(item.value) / max) * 100}%`,
                background: item.color || reportColors[index % reportColors.length],
              }}
            />
          </div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export function SegmentedChart({
  items,
  formatValue,
  emptyMessage,
}: {
  items: ReportDatum[]
  formatValue: (value: number) => string
  emptyMessage: string
}) {
  const total = totalOf(items)
  if (!total) return <p className="report-viz-empty">{emptyMessage}</p>
  return (
    <div className="report-segmented">
      <div className="report-segmented-track" aria-hidden="true">
        {items.map((item, index) => (
          <span
            key={item.label}
            style={{
              width: `${(positive(item.value) / total) * 100}%`,
              background: item.color || reportColors[index % reportColors.length],
            }}
          />
        ))}
      </div>
      <ul className="report-segmented-legend">
        {items.map((item, index) => (
          <li key={item.label}>
            <i style={{ background: item.color || reportColors[index % reportColors.length] }} />
            <span>{item.label}</span>
            <strong>{formatValue(item.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TrendChart({
  items,
  formatValue,
  emptyMessage,
}: {
  items: ReportDatum[]
  formatValue: (value: number) => string
  emptyMessage: string
}) {
  if (!items.length) return <p className="report-viz-empty">{emptyMessage}</p>
  const max = Math.max(1, ...items.map((item) => positive(item.value)))
  const points = items.map((item, index) => ({
    x: items.length === 1 ? 160 : 18 + (index / (items.length - 1)) * 284,
    y: 108 - (positive(item.value) / max) * 82,
  }))
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `18,108 ${line} 302,108`
  return (
    <div className="report-trend">
      <div className="report-trend-plot">
        <svg viewBox="0 0 320 122" preserveAspectRatio="none" aria-hidden="true">
          <line x1="18" y1="26" x2="302" y2="26" />
          <line x1="18" y1="67" x2="302" y2="67" />
          <line x1="18" y1="108" x2="302" y2="108" />
          <polygon points={area} />
          <polyline points={line} />
          {points.length === 1 && <circle cx={points[0].x} cy={points[0].y} r="4" />}
        </svg>
      </div>
      <div className="report-trend-axis">
        <span>{items[0].label}</span>
        <span>{items.at(-1)?.label}</span>
      </div>
      <div className="report-trend-data">
        {items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{formatValue(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
