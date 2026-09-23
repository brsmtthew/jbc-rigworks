import { RequestInbox } from './RequestInbox'
import { useWorkspace } from '../../lib/workspaceStorage'
import { useState } from 'react'
import { CalendarDays, ChevronRight, Laptop, Plus, Wrench } from 'lucide-react'
import { formatPHP } from '../../data/appData'
import { formatDate } from '../../lib/business'
import { useListFilters } from '../../hooks/useListFilters'
import { EntryForm } from '../../components/ui/EntryForm'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PageHeader } from '../../components/ui/PageHeader'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { StatStrip } from '../../components/ui/StatStrip'
import type { Job } from '../../types/business'

export function JobsPage({ onCreate }: { onCreate: () => void }) {
  const workspace = useWorkspace()
  const { jobs } = workspace
  const filters = useListFilters()
  const [selected, setSelected] = useState<Job | null>(null)
  const filtered = jobs.filter(job => filters.matches([job.id, job.customer, job.device, job.service].join(' ')) && (filters.filter === 'all' || job.status === filters.filter))
  return <>
    <PageHeader eyebrow="WORKSHOP FLOW" title="Service jobs" description="A smooth handoff, from check-in to pickup.">
      <button className="primary-button" onClick={onCreate} title="New service job" aria-label="New service job"><Plus size={20} /></button>
    </PageHeader>
    <StatStrip stats={[
      { label: 'Active jobs', value: jobs.filter(job => job.status !== 'Completed').length },
      { label: 'In progress', value: jobs.filter(job => job.status === 'In progress').length },
      { label: 'Ready for pickup', value: jobs.filter(job => job.status === 'Ready').length },
      { label: 'Quoted value', value: formatPHP(jobs.reduce((sum, job) => sum + job.quote, 0), true) },
    ]} />
    <RequestInbox />
    <h2 className="section-title">Workshop jobs</h2>
    <ListToolbar {...filters} label="Search service jobs" count={filtered.length} onReset={filters.reset}
      options={['all', 'Queued', 'In progress', 'Ready', 'Completed'].map(value => ({ value, label: value === 'all' ? 'All statuses' : value }))} />
    <div className="jobs-grid">{filtered.map(job => <article className="job-card" key={job.id}>
      <div className="job-card-top"><span className="device-icon">{job.device.includes('desktop') ? <Wrench size={22} /> : <Laptop size={22} />}</span><StatusBadge tone={job.status === 'In progress' ? 'blue' : ['Ready', 'Completed'].includes(job.status) ? 'green' : 'amber'}>{job.status}</StatusBadge></div>
      <span className="job-id">{job.id}</span><h2>{job.customer}</h2><p className="job-device">{job.device}</p>
      <p className="job-service">{job.service}</p>
      <div className="job-meta"><span><CalendarDays size={15} />{formatDate(job.due)}</span><strong>{formatPHP(job.quote)}</strong></div>
      <button className="card-link" onClick={() => setSelected(job)} aria-label="Manage job" title="Manage job"><ChevronRight size={17} /></button>
    </article>)}</div>
    {!filtered.length && <div className="empty-state" role="status"><Wrench size={28} /><h3>No jobs found</h3><p>{jobs.length ? "Try a different status or customer name." : "Add your first service job to start the queue."}</p>{(filters.query || filters.filter !== "all") && <button className="secondary-button" onClick={filters.reset}>Reset filters</button>}</div>}
    {selected && <EntryForm initialType="job" record={selected} onClose={() => setSelected(null)} />}
  </>
}
