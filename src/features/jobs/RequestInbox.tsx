import { useState, type FormEvent } from 'react'
import { Banknote, ClipboardList, Eye, Pencil, ReceiptText, Save, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePaymentProofs } from '../../lib/payments'
import { Dialog } from '../../components/ui/Dialog'
import { ActionButton } from '../../components/ui/ActionButton'
import { DataTable } from '../../components/ui/DataTable'
import { Panel } from '../../components/ui/Panel'
import { useAuth } from '../../lib/auth-context'
import { useWorkspace } from '../../lib/workspaceStorage'
import { receiveAppointmentAsJob, savePcQuote, updateAppointmentStatus, useAllRequests } from '../../lib/customerStorage'
import { formatPHP } from '../../data/appData'
import { InvoiceDialog } from '../sales/InvoiceDialog'
import type { CustomerAppointment, CustomPcRequest, Sale } from '../../types/business'
import { useConfirmation } from '../../components/ui/confirmation-context'

type RequestRow = {
  id: string
  customerId: string
  owner: string
  kind: 'Booking' | 'PC request'
  record: CustomerAppointment | CustomPcRequest
}

export function RequestInbox() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const proofs = usePaymentProofs(user)
  const { appointments, requests, error: requestsError } = useAllRequests(user?.role === 'admin')
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

  const rows: RequestRow[] = [
    ...appointments.map(record => ({ id: record.id, customerId: record.customerId || '', owner: record.customerName || record.customerId || '', kind: 'Booking' as const, record })),
    ...requests.map(record => ({ id: record.id, customerId: record.customerId || '', owner: record.customerName || record.customerId || '', kind: 'PC request' as const, record })),
  ]

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
      if (!confirmed && !await confirm({ title: 'Update appointment status?', message: `Change this appointment request to ${nextStatus}?`, confirmLabel: 'Save status' })) return
      if (!user) throw new Error('Sign in again to update appointments.')
      await updateAppointmentStatus(user, selected.id, nextStatus as CustomerAppointment['status'])
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
      if (!user) throw new Error('Sign in again to receive appointments.')
      await receiveAppointmentAsJob(user, selected.id)
      setSelected(null)
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
      const updated = await savePcQuote(user, selected.customerId, selected.id, { amount, message: quoteMessage })
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
      const latest = workspace.orders.find(value => value.id === order.id)
      if (!latest) throw new Error('Order unavailable.')
      if (!await confirm({ title: 'Update order status?', message: `Change ${order.id} to ${orderStatus}?`, confirmLabel: 'Save status' })) return
      await workspace.updateOrderStatus(latest.id, orderStatus as NonNullable<Sale['orderStatus']>)
      setOrder(null)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const orders = workspace.orders
  const selectedPcRequest = selected && !('service' in selected.record) ? selected.record : null
  const canQuote = selectedPcRequest && ['Under review', 'Quoted'].includes(selectedPcRequest.status)

  return <div className="request-inbox">
    <Panel title="Customer requests" subtitle="Bookings and PC requests from all devices" action={<ClipboardList size={22} />}>
      <DataTable rows={rows} label="Customer requests" columns={[
        { label: 'Customer', sortValue: row => row.owner, render: row => row.owner },
        { label: 'Type', render: row => row.kind },
        { label: 'Request', render: row => 'service' in row.record ? row.record.service : row.record.useCase + ' PC' },
        { label: 'Status', render: row => row.record.status },
        { label: 'Actions', render: row => <ActionButton label={'Review ' + row.id} onClick={() => openRequest(row)}><Eye size={18} /></ActionButton> },
      ]} />
    </Panel>

    <Panel title="Online transactions" subtitle="Prepare pickup orders and review payments in the POS">
      <DataTable rows={orders} label="Online transactions" columns={[
        { label: 'Customer', render: row => row.customer },
        { label: 'Invoice', render: row => row.id },
        { label: 'Fulfillment', render: row => row.fulfillment?.mode || 'Pickup' },
        { label: 'Status', render: row => row.orderStatus || 'Requested' },
        { label: 'Payment', render: row => proofs.rows.some(proof => proof.orderId === row.id && proof.status === 'Pending') ? 'Proof awaiting review' : row.status },
        { label: 'Actions', render: row => <div className="part-actions">
          <ActionButton label={'Open POS ' + row.id} disabled={row.orderStatus === 'Declined'} onClick={() => navigate('/pos', { state: { collectSaleId: row.id } })}><Banknote size={18} /></ActionButton>
          <ActionButton label={'Process ' + row.id} onClick={() => { setOrder(row); setOrderStatus(row.orderStatus || 'Requested'); setError('') }}><Wrench size={18} /></ActionButton>
          <ActionButton label={'Invoice ' + row.id} onClick={() => setInvoice(row)}><ReceiptText size={18} /></ActionButton>
        </div> },
      ]} />
    </Panel>

    {requestsError && <p role="alert" className="form-error">Could not load customer requests: {requestsError}</p>}
    {proofs.error && <p role="alert" className="form-error">Could not load payment proofs: {proofs.error}</p>}

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
          {['Requested', 'Processing', 'Ready', 'Completed', 'Declined'].map(value => <option key={value}>{value}</option>)}
        </select></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <ActionButton variant="labeled" label="Save order status" onClick={saveOrderStatus}><Save size={18} /></ActionButton>
      </div>
    </Dialog>}
    {invoice && <InvoiceDialog sale={invoice} onClose={() => setInvoice(null)} />}
  </div>
}
