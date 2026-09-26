import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CircleCheck, CircleX, Cpu, Eye, FileQuestion, Save, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { Dialog } from '../../components/ui/Dialog'
import { ActionButton } from '../../components/ui/ActionButton'
import { useAuth } from '../../lib/auth-context'
import { changePendingRequest, respondToPcQuote, useCustomerRequests } from '../../lib/customerStorage'
import { formatPHP } from '../../data/appData'
import { today } from '../../lib/workspaceStorage'
import { useDirectories } from '../../lib/directories'
import type { CustomerAppointment, CustomPcRequest } from '../../types/business'
import { useConfirmation } from '../../components/ui/confirmation-context'

export function CustomerRecordsPage({ kind, embedded = false }: { kind: 'appointments' | 'requests'; embedded?: boolean }) {
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const [directory] = useDirectories()
  const [selected, setSelected] = useState<CustomerAppointment | CustomPcRequest | null>(null)
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')
  const { appointments, requests, error: loadError, loading } = useCustomerRequests(user)

  if (!user) return null
  const isAppointments = kind === 'appointments'
  const rows = isAppointments ? appointments : requests

  function open(item: CustomerAppointment | CustomPcRequest) {
    setSelected(item)
    setNotes(item.notes)
    setDate('preferredDate' in item ? item.preferredDate : '')
    setTime('preferredDate' in item ? item.preferredTime : '')
    setError('')
  }

  async function change(remove = false) {
    if (!selected) return
    try {
      if (!remove && 'preferredDate' in selected && (!date || date < today() || !time)) {
        throw new Error('Select a current or future date and a time.')
      }
      if (!await confirm({ title: remove ? 'Delete request?' : 'Save request changes?', message: remove ? 'Permanently delete this pending request?' : 'Save your changes to this request?', confirmLabel: remove ? 'Delete request' : 'Save changes', tone: remove ? 'danger' : 'primary' })) return
      await changePendingRequest(user!, kind, selected.id, remove ? null : { notes, preferredDate: date, preferredTime: time })
      setSelected(null)
      setError('')
    } catch (err) {
      setError((err as Error).message || 'Unable to save your request.')
    }
  }

  async function respondToQuote(response: 'Approved' | 'Declined') {
    if (!user || !selected || 'service' in selected) return
    if (!await confirm({ title: response === 'Approved' ? 'Accept this quote?' : 'Decline this quote?', message: response === 'Approved' ? 'Record your approval for this PC build quote?' : 'Record that you are declining this PC build quote?', confirmLabel: response === 'Approved' ? 'Accept quote' : 'Decline quote', tone: response === 'Declined' ? 'danger' : 'primary' })) return
    try {
      setSelected(await respondToPcQuote(user, selected.id, response))
      setError('')
    } catch (err) {
      setError((err as Error).message || 'Unable to update this quote.')
    }
  }

  const editable = selected && ['Requested', 'Under review'].includes(selected.status)
  const quotedPcRequest = selected && !('service' in selected) && selected.status === 'Quoted' && selected.quote

  return <>
    {!embedded && <PageHeader eyebrow="CUSTOMER PORTAL" title={isAppointments ? 'My appointments' : 'My PC requests'} description="Your saved requests and their details." />}
    <Panel title={isAppointments ? 'Appointment requests' : 'Custom build requests'}>
      {loadError ? <p className="form-error" role="alert">{loadError}</p> : loading ? <p role="status">Loading requests…</p> : !rows.length ? <div className="customer-empty large">
        <FileQuestion size={30} />
        <h3>{isAppointments ? 'No appointments yet' : 'No PC requests yet'}</h3>
        <Link className="primary-button" to={isAppointments ? '/customer/book' : '/customer/pc-building'}>
          {isAppointments ? <CalendarDays size={16} /> : <Cpu size={16} />}
          {isAppointments ? 'Book a service' : 'Start a PC request'}
        </Link>
      </div> : <div className="request-records">
        {rows.map(item => <article key={item.id}>
          <div className="request-record-heading">
            <div>
              <strong>{'service' in item ? item.service : item.useCase + ' PC'}</strong>
              <small>{item.id}{'device' in item ? ' / ' + item.device : ''}</small>
            </div>
            <em>{item.status}</em>
          </div>
          <p>{'preferredDate' in item ? item.preferredDate + ' / ' + item.preferredTime : item.tier || 'Tier to be confirmed'}</p>
          <ActionButton label={'service' in item ? 'View appointment details' : 'View selected parts'} onClick={() => open(item)}><Eye size={20} /></ActionButton>
        </article>)}
      </div>}
    </Panel>

    {selected && <Dialog title={'service' in selected ? 'Appointment details' : 'Build request details'} onClose={() => setSelected(null)}>
      <div className="portal-form settings-fields">
        {'service' in selected ? <>
          <h3>{selected.service} / {selected.device}</h3>
          {selected.visit && <>
            <p>{selected.visit.mode} / {selected.visit.address} {selected.visit.mode === 'Home service' ? selected.visit.distanceKm + ' km one way' : ''}</p>
            <dl className="checkout-totals">
              {[
                ['Service', selected.visit.basePrice],
                ['Home surcharge', selected.visit.surcharge],
                ['Transportation', selected.visit.transport],
                ['Estimated total', selected.visit.estimate],
              ].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value === null ? 'Quote required' : formatPHP(Number(value))}</dd></div>)}
            </dl>
          </>}
          <label>Preferred date<input type="date" required min={today()} disabled={!editable} value={date} onChange={event => setDate(event.target.value)} /></label>
          <label>Preferred time<select disabled={!editable} value={time} onChange={event => setTime(event.target.value)}>
            {[...new Set([time, ...directory.times])].filter(Boolean).map(value => <option key={value}>{value}</option>)}
          </select></label>
        </> : <>
          <p>{selected.useCase} / Budget {selected.budget || 'Not specified'}</p>
          {selected.parts?.map(part => <p key={part.component}><strong>{part.component}:</strong> {[part.brand, part.model].filter(Boolean).join(' / ')} ({part.source}){part.price !== undefined ? ` / ${formatPHP(part.price)}` : ''}{part.specs ? <small className="request-part-specs">{part.specs}</small> : null}</p>)}
          {selected.quote && <section className="quote-card" aria-label="Workshop quote">
            <span className="eyebrow">WORKSHOP QUOTE</span>
            <strong>{formatPHP(selected.quote.amount)}</strong>
            <p>{selected.quote.message}</p>
            <small>Prepared {new Date(selected.quote.createdAt).toLocaleDateString('en-PH')}</small>
          </section>}
          {quotedPcRequest && <p className="storage-caption">Accepting records your approval for this build. It does not collect payment or place an order.</p>}
        </>}

        <label>Request notes<textarea rows={4} maxLength={1000} value={notes} disabled={!editable} onChange={event => setNotes(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {editable && <div className="dialog-actions">
          <ActionButton label="Delete request" onClick={() => change(true)}><Trash2 size={20} /></ActionButton>
          <ActionButton variant="labeled" label="Save request changes" onClick={() => change()}><Save size={18} /></ActionButton>
        </div>}
        {quotedPcRequest && <div className="dialog-actions quote-actions">
          <button type="button" className="secondary-button" onClick={() => respondToQuote('Declined')}><CircleX size={18} />Decline quote</button>
          <button type="button" className="primary-button" onClick={() => respondToQuote('Approved')}><CircleCheck size={18} />Accept quote</button>
        </div>}
      </div>
    </Dialog>}
  </>
}
