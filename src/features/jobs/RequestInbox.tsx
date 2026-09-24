import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { ClipboardList, Eye, Pencil, ReceiptText, Save, Wrench } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { ActionButton } from '../../components/ui/ActionButton'
import { DataTable } from '../../components/ui/DataTable'
import { Panel } from '../../components/ui/Panel'
import { useAuth } from '../../lib/auth-context'
import { useWorkspace } from '../../lib/workspaceStorage'
import { savePcQuote } from '../../lib/customerStorage'
import { formatPHP } from '../../data/appData'
import { InvoiceDialog } from '../sales/InvoiceDialog'
import type { CustomerAppointment, CustomPcRequest, Sale } from '../../types/business'
import { useConfirmation } from '../../components/ui/confirmation-context'

type RequestRow = {
  id: string
  key: string
  customerId: string
  owner: string
  kind: 'Booking' | 'PC request'
  record: CustomerAppointment | CustomPcRequest
}

const appointmentPrefix = 'jbc-rigworks:appointments:'
const requestPrefix = 'jbc-rigworks:pc-requests:'

function snapshot() {
  try {
    return JSON.stringify(Object.keys(localStorage)
      .filter(key => key.startsWith(appointmentPrefix) || key.startsWith(requestPrefix))
      .sort()
      .map(key => [key, localStorage.getItem(key)]))
  } catch {
    return '[]'
  }
}

function subscribe(fn: () => void) {
  window.addEventListener('storage', fn)
  window.addEventListener('jbc-requests-change', fn)
  return () => {
    window.removeEventListener('storage', fn)
    window.removeEventListener('jbc-requests-change', fn)
  }
}

export function RequestInbox() {
  const raw = useSyncExternalStore(subscribe, snapshot)
  const { user } = useAuth()
  const workspace = useWorkspace()
  const { confirm } = useConfirmation()
  const [selected, setSelected] = useState<RequestRow | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState<Sale | null>(null)
  const [order, setOrder] = useState<Sale | null>(null)
  const [orderStatus, setOrderStatus] = useState('Requested')
  const [quoteEditing, setQuoteEditing] = useState(false)
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteMessage, setQuoteMessage] = useState('')

  const rows: RequestRow[] = []
  let invalid = false
  try {
    for (const [key, value] of JSON.parse(raw) as [string, string][]) {
      try {
        const data = JSON.parse(value)
        if (!Array.isArray(data)) throw new Error('Invalid request list')
        for (const record of data) {
          if (!record || typeof record.id !== 'string' || typeof record.status !== 'string') {
            invalid = true
            continue
          }
          if (record.shopId && record.shopId !== user?.id) continue
          const kind = key.startsWith(appointmentPrefix) ? 'Booking' : 'PC request'
          const customerId = key.slice(kind === 'Booking' ? appointmentPrefix.length : requestPrefix.length)
          rows.push({
            id: record.id,
            key,
            customerId,
            owner: record.customerName || customerId,
            kind,
            record,
          })
        }
      } catch {
        invalid = true
      }
    }
  } catch {
    invalid = true
  }

  function openRequest(row: RequestRow) {
    setSelected(row)
    setStatus(row.record.status)
    setError('')
    setQuoteEditing(false)
    if ('service' in row.record) {
      setQuoteAmount('')
      setQuoteMessage('')
    } else {
      setQuoteAmount(row.record.quote ? String(row.record.quote.amount) : '')
      setQuoteMessage(row.record.quote?.message ?? '')
    }
  }

  async function updateBookingStatus(nextStatus = status, confirmed = false) {
    if (!selected || selected.kind !== 'Booking') return
    try {
      const current = JSON.parse(localStorage.getItem(selected.key) || '[]')
      if (!Array.isArray(current) || !current.some((record: CustomerAppointment) => record.id === selected.id)) {
        throw new Error('This request is no longer available.')
      }
      if (!confirmed && !await confirm({ title: 'Update appointment status?', message: `Change this appointment request to ${nextStatus}?`, confirmLabel: 'Save status' })) return
      localStorage.setItem(selected.key, JSON.stringify(current.map((record: CustomerAppointment) =>
        record.id === selected.id ? { ...record, status: nextStatus } : record)))
      window.dispatchEvent(new Event('jbc-requests-change'))
      setSelected(null)
      setError('')
    } catch (err) {
      setError((err as Error).message || 'Could not update the request.')
    }
  }

  async function receiveBooking() {
    if (!selected || selected.kind !== 'Booking' || !('service' in selected.record)) return
    try {
      const record = selected.record
      const id = 'JOB-' + record.id
      if (!['Requested', 'Confirmed'].includes(record.status)) {
        throw new Error('Only a requested or confirmed booking can become a service job.')
      }
      if (workspace.jobs.some(job => job.id === id)) throw new Error('This request already has a service job.')
      if (!await confirm({ title: 'Receive appointment?', message: `Create a service job for ${selected.owner} and confirm this appointment?`, confirmLabel: 'Receive as job' })) return
      workspace.save('jobs', {
        id,
        customer: selected.owner,
        device: record.device,
        service: record.service + (record.visit?.mode === 'Home service' ? ' / Home service: ' + record.visit.address : ''),
        due: record.preferredDate,
        quote: record.visit?.estimate || 0,
        status: 'Queued',
      })
      await updateBookingStatus('Confirmed', true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || selected.kind !== 'PC request' || !user) return
    const amount = Number(quoteAmount)
    if (!quoteAmount.trim() || !Number.isFinite(amount) || amount < 0 || !quoteMessage.trim()) {
      setError('Enter a valid quote amount and a message for the customer.')
      return
    }
    try {
      if (!await confirm({ title: 'Save quote?', message: `Send this ${formatPHP(amount)} quote to ${selected.owner}?`, confirmLabel: 'Save quote' })) return
      const updated = savePcQuote(user, selected.customerId, selected.id, { amount, message: quoteMessage })
      setSelected({ ...selected, record: updated })
      setStatus(updated.status)
      setQuoteEditing(false)
      setError('')
    } catch (err) {
      setError((err as Error).message || 'Could not save the quote.')
    }
  }

  async function saveOrderStatus() {
    if (!order) return
    try {
      const latest = workspace.sales.find(value => value.id === order.id)
      if (!latest) throw new Error('Order unavailable.')
      if (!await confirm({ title: 'Update order status?', message: `Change ${order.id} to ${orderStatus}?`, confirmLabel: 'Save status' })) return
      workspace.save('sales', { ...latest, orderStatus: orderStatus as Sale['orderStatus'] })
      setOrder(null)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const orders = workspace.sales.filter(sale => sale.channel === 'Online')
  const selectedPcRequest = selected && !('service' in selected.record) ? selected.record : null
  const canQuote = selectedPcRequest && ['Under review', 'Quoted'].includes(selectedPcRequest.status)

  return <div className="request-inbox">
    <Panel title="Customer requests" subtitle="Bookings and PC requests saved in this browser" action={<ClipboardList size={22} />}>
      <DataTable rows={rows} label="Customer requests" columns={[
        { label: 'Customer', sortValue: row => row.owner, render: row => row.owner },
        { label: 'Type', render: row => row.kind },
        { label: 'Request', render: row => 'service' in row.record ? row.record.service : row.record.useCase + ' PC' },
        { label: 'Status', render: row => row.record.status },
        { label: 'Actions', render: row => <ActionButton label={'Review ' + row.id} onClick={() => openRequest(row)}><Eye size={18} /></ActionButton> },
      ]} />
    </Panel>

    <Panel title="Online transactions" subtitle="Process pickup and delivery orders">
      <DataTable rows={orders} label="Online transactions" columns={[
        { label: 'Customer', render: row => row.customer },
        { label: 'Invoice', render: row => row.id },
        { label: 'Fulfillment', render: row => row.fulfillment?.mode || 'Pickup' },
        { label: 'Status', render: row => row.orderStatus || 'Requested' },
        { label: 'Actions', render: row => <div className="part-actions">
          <ActionButton label={'Process ' + row.id} onClick={() => { setOrder(row); setOrderStatus(row.orderStatus || 'Requested'); setError('') }}><Wrench size={18} /></ActionButton>
          <ActionButton label={'Invoice ' + row.id} onClick={() => setInvoice(row)}><ReceiptText size={18} /></ActionButton>
        </div> },
      ]} />
    </Panel>

    {invalid && <p role="alert" className="form-error">Some saved requests could not be read. Their original data has been preserved.</p>}

    {selected && <Dialog title={quoteEditing ? 'Prepare PC quote' : 'Review ' + selected.id} onClose={() => { setSelected(null); setQuoteEditing(false) }}>
      {quoteEditing && selected.kind === 'PC request' && !('service' in selected.record) ? <form className="portal-form settings-fields" onSubmit={submitQuote}>
        <p>Send a clear price and next step. The customer can accept or decline this quote from My records.</p>
        <label>Quoted total (PHP)<input required type="number" min="0" step="0.01" value={quoteAmount} onChange={event => setQuoteAmount(event.target.value)} /></label>
        <label>Quote details<textarea required rows={5} maxLength={1000} value={quoteMessage} onChange={event => setQuoteMessage(event.target.value)} placeholder="Included parts, labor, exclusions, and expected timing" /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={() => { setQuoteEditing(false); setError('') }}>Back to request</button>
          <button type="submit" className="primary-button"><Save size={18} />Save quote</button>
        </div>
      </form> : <div className="portal-form settings-fields">
        <h3>{selected.owner}</h3>
        <p>{selected.record.customerEmail}</p>
        {'service' in selected.record ? <>
          <dl className="detail-list">
            <div><dt>Service</dt><dd>{selected.record.service}</dd></div>
            <div><dt>Device</dt><dd>{selected.record.device}</dd></div>
            <div><dt>Schedule</dt><dd>{selected.record.preferredDate} / {selected.record.preferredTime}</dd></div>
            <div><dt>Visit</dt><dd>{selected.record.visit?.mode || 'Workshop'} {selected.record.visit?.address}</dd></div>
          </dl>
          <p className="product-specs">{selected.record.notes}</p>
          <label>Request status<select aria-label="Request status" value={status} onChange={event => setStatus(event.target.value)}>
            {['Requested', 'Confirmed', 'Completed', 'Cancelled'].map(value => <option key={value}>{value}</option>)}
          </select></label>
        </> : <>
          <p>{selected.record.useCase} / {selected.record.tier || 'Unclassified'}</p>
          <ul>{selected.record.parts?.map(part => <li key={part.component}>{part.component}: {[part.brand, part.model].filter(Boolean).join(' / ')} ({part.source}){part.price !== undefined ? ` / ${formatPHP(part.price)}` : ''}{part.specs ? <small className="request-part-specs">{part.specs}</small> : null}</li>)}</ul>
          <p>Budget: {selected.record.budget || 'Not specified'}</p>
          <p className="product-specs">{selected.record.notes}</p>
          {selected.record.quote && <section className="quote-card" aria-label="Current quote">
            <span className="eyebrow">CURRENT QUOTE</span>
            <strong>{formatPHP(selected.record.quote.amount)}</strong>
            <p>{selected.record.quote.message}</p>
            <small>Prepared {new Date(selected.record.quote.createdAt).toLocaleDateString('en-PH')}</small>
          </section>}
        </>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="dialog-actions">
          {selected.kind === 'Booking' && <>
            <ActionButton variant="labeled" label="Receive as service job" disabled={!['Requested', 'Confirmed'].includes(selected.record.status) || workspace.jobs.some(job => job.id === 'JOB-' + selected.id)} onClick={receiveBooking}><Wrench size={18} /></ActionButton>
            <ActionButton variant="labeled" label="Save request status" onClick={() => updateBookingStatus()}><Save size={18} /></ActionButton>
          </>}
          {selected.kind === 'PC request' && selectedPcRequest && <ActionButton variant="labeled" label={selectedPcRequest.quote ? 'Update quote' : 'Prepare quote'} disabled={!canQuote} onClick={() => { setQuoteAmount(selectedPcRequest.quote ? String(selectedPcRequest.quote.amount) : ''); setQuoteMessage(selectedPcRequest.quote?.message ?? ''); setQuoteEditing(true); setError('') }}><Pencil size={18} /></ActionButton>}
        </div>
      </div>}
    </Dialog>}

    {order && <Dialog title={'Process ' + order.id} onClose={() => setOrder(null)}>
      <div className="portal-form settings-fields">
        <p>{order.customer} / {order.contact}</p>
        <p>{order.detail}</p>
        <p>{order.fulfillment?.address}</p>
        <label>Order status<select aria-label="Order status" value={orderStatus} onChange={event => setOrderStatus(event.target.value)}>
          {['Requested', 'Processing', 'Ready', 'Completed'].map(value => <option key={value}>{value}</option>)}
        </select></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <ActionButton variant="labeled" label="Save order status" onClick={saveOrderStatus}><Save size={18} /></ActionButton>
      </div>
    </Dialog>}
    {invoice && <InvoiceDialog sale={invoice} onClose={() => setInvoice(null)} />}
  </div>
}
