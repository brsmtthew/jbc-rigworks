import { RequestInbox } from './RequestInbox'
import { useWorkspace } from '../../lib/workspaceStorage'
import { useState } from 'react'
import { CalendarDays, CircleCheck, Laptop, Plus, ReceiptText, Wrench } from 'lucide-react'
import { formatPHP } from '../../data/appData'
import { formatDate } from '../../lib/business'
import { useListFilters } from '../../hooks/useListFilters'
import { EntryForm } from '../../components/ui/EntryForm'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PageHeader } from '../../components/ui/PageHeader'
import { ListToolbar } from '../../components/ui/ListToolbar'
import { StatStrip } from '../../components/ui/StatStrip'
import { InvoiceDialog } from '../sales/InvoiceDialog'
import { useNavigate } from 'react-router-dom'
import type { Job, Sale } from '../../types/business'

export function JobsPage({ onCreate }: { onCreate: () => void }) {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const { jobs } = workspace
  const filters = useListFilters()
  const [view, setView] = useState<'jobs' | 'requests'>('jobs')
  const [selected, setSelected] = useState<Job | null>(null)
  const [invoice, setInvoice] = useState<Sale | null>(null)
  const filtered = jobs.filter(job => filters.matches([job.id, job.customer, job.device, job.service].join(' ')) && (filters.filter === 'all' || job.status === filters.filter))
  const readyJobs = jobs.filter(job => job.status === 'Ready')

  function sendToCashier(job: Job) {
    navigate('/pos', { state: { job } })
  }

  function openInvoice(sale: Sale) {
    if (sale.total > sale.paid) navigate('/pos', { state: { collectSaleId: sale.id } })
    else setInvoice(sale)
  }

  return <>
    <PageHeader eyebrow="WORKSHOP FLOW" title="Service jobs" description="Track each repair from check-in through POS checkout.">
      <button className="primary-button" onClick={onCreate}><Plus size={18} />New service job</button>
    </PageHeader>
    <div className="job-workflow-switch" role="tablist" aria-label="Workshop workflow">
      <button role="tab" aria-selected={view === 'jobs'} className={view === 'jobs' ? 'is-selected' : ''} onClick={() => setView('jobs')}><Wrench size={17} />Service jobs <span>{jobs.length}</span></button>
      <button role="tab" aria-selected={view === 'requests'} className={view === 'requests' ? 'is-selected' : ''} onClick={() => setView('requests')}><ReceiptText size={17} />Customer requests & online orders</button>
    </div>
    {view === 'requests' ? <RequestInbox /> : <>
      <div className="job-flow-banner"><ol aria-label="Service workflow"><li><span>1</span>Check in</li><li><span>2</span>Repair</li><li><span>3</span>Mark ready</li><li><span>4</span>Cashier in POS</li><li><span>5</span>Complete</li></ol><p>Ready jobs move to POS for invoicing and payment. POS checkout completes the job and links its invoice.</p></div>
      <StatStrip stats={[
        { label: 'Queued', value: jobs.filter(job => job.status === 'Queued').length },
        { label: 'In progress', value: jobs.filter(job => job.status === 'In progress').length },
        { label: 'Ready for cashier', value: readyJobs.length },
        { label: 'Completed', value: jobs.filter(job => job.status === 'Completed').length },
      ]} />
      <ListToolbar {...filters} label="Search service jobs" count={filtered.length} onReset={filters.reset}
        options={['all', 'Queued', 'In progress', 'Ready', 'Completed'].map(value => ({ value, label: value === 'all' ? 'All stages' : value === 'Ready' ? 'Ready for cashier' : value }))} />
      <div className="jobs-grid">{filtered.map(job => {
        const linkedSale = workspace.sales.find(sale => sale.serviceJobId === job.id)
        const tone = job.status === 'In progress' ? 'blue' : job.status === 'Completed' ? 'green' : job.status === 'Ready' ? 'amber' : 'gray'
        return <article className="job-card" key={job.id}>
          <div className="job-card-top"><span className="device-icon">{job.device.toLowerCase().includes('desktop') ? <Wrench size={22} /> : <Laptop size={22} />}</span><StatusBadge tone={tone}>{job.status === 'Ready' ? 'Ready for cashier' : job.status}</StatusBadge></div>
          <span className="job-id">{job.id}</span><h2>{job.customer}</h2><p className="job-device">{job.device}</p>
          <p className="job-service">{job.service}</p>
          <div className="job-meta"><span><CalendarDays size={15} />{formatDate(job.due)}</span><strong>{formatPHP(job.quote)} estimate</strong></div>
          <div className="job-card-actions">
            <button type="button" className="secondary-button" onClick={() => setSelected(job)}>Update job</button>
            {linkedSale ? <button type="button" className="primary-button" onClick={() => openInvoice(linkedSale)}>{linkedSale.total > linkedSale.paid ? <><ReceiptText size={17} />Collect balance</> : <><CircleCheck size={17} />View invoice</>}</button> : job.status === 'Ready' ? <button type="button" className="primary-button" onClick={() => sendToCashier(job)}><ReceiptText size={17} />Send to POS</button> : null}
          </div>
        </article>
      })}</div>
      {!filtered.length && <div className="empty-state" role="status"><Wrench size={28} /><h3>No service jobs in this view</h3><p>{jobs.length ? 'Try another stage or search term.' : 'Create a service job or receive a customer booking to start the queue.'}</p>{(filters.query || filters.filter !== 'all') && <button className="secondary-button" onClick={filters.reset}>Reset filters</button>}</div>}
    </>}
    {selected && <EntryForm initialType="job" record={selected} onClose={() => setSelected(null)} />}
    {invoice && <InvoiceDialog sale={invoice} onClose={() => setInvoice(null)} />}
  </>
}
