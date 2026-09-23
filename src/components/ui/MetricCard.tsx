import type { LucideIcon } from 'lucide-react'

type MetricCardProps = {
  label: string
  value: string
  note: string
  icon: LucideIcon
  dark?: boolean
}

export function MetricCard({ label, value, note, icon: Icon, dark = false }: MetricCardProps) {
  return (
    <article className={`metric-card ${dark ? 'metric-card-dark' : ''}`}>
      <div className="metric-label">
        <span>{label}</span>
        <span className="metric-icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
      </div>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  )
}
