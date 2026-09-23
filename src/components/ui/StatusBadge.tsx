type StatusBadgeProps = {
  children: string
  tone?: 'green' | 'blue' | 'amber' | 'gray' | 'red'
}

export function StatusBadge({ children, tone = 'gray' }: StatusBadgeProps) {
  return <span className={`status-badge status-${tone}`}>{children}</span>
}
