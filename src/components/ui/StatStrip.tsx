export function StatStrip({ stats }: { stats: { label: string; value: string | number }[] }) {
  return <dl className="mini-stats">{stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
}
