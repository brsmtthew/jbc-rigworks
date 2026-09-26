import { useDirectories } from '../../lib/directories'
import { Dialog } from '../../components/ui/Dialog'
import { today } from '../../lib/workspaceStorage'
import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Send, CalendarDays, CheckCircle2, House, MapPin } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { useAuth } from '../../lib/auth-context'
import { saveAppointment } from '../../lib/customerStorage'
import { accountKey, defaultAccount, useShopSettings, useStoredValue } from '../../lib/preferences'
import { optionalPrice, transportation } from '../../lib/fulfillment'
import { money } from '../../lib/commerce'
import { formatPHP } from '../../data/appData'
import { tiers } from '../../lib/pc'
import type { Tier } from '../../types/business'
import { useConfirmation } from '../../components/ui/confirmation-context'
export function BookServicePage() {
  const [directory] = useDirectories()
  const services = directory.services
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [shop] = useShopSettings()
  const [profile] = useStoredValue(accountKey(user!.id), defaultAccount)
  const [open, setOpen] = useState(false)
  const [serviceChoice, setService] = useState(params.get('device') === 'Laptop' ? services[1] : services[0])
  const service = services.includes(serviceChoice) ? serviceChoice : services[0]
  const [tier, setTier] = useState<Tier>(tiers.includes(params.get('tier') as Tier) ? params.get('tier') as Tier : 'Low')
  const [mode, setMode] = useState<'Workshop' | 'Home service'>('Workshop')
  const [addressChoice, setAddress] = useState<string | null>(null), [distance, setDistance] = useState('')
  const address = addressChoice ?? profile.address
  const [device, setDevice] = useState(''), [date, setDate] = useState(''), [time, setTime] = useState(''), [notes, setNotes] = useState('')
  const [error, setError] = useState(''), [submitted, setSubmitted] = useState(false)
  const submitting = useRef(false)
  const [busy, setBusy] = useState(false)
  const basePrice = service.includes('deep cleaning') ? optionalPrice(shop.cleaning[service.startsWith('Laptop') ? 'Laptop' : 'Desktop'][tier]) : null
  const surcharge = mode === 'Workshop' ? 0 : optionalPrice(shop.homeSurcharge)
  const transport = mode === 'Workshop' ? 0 : distance === '' ? null : transportation(shop, Number(distance))
  const subtotal = basePrice === null || surcharge === null || transport === null ? null : money(basePrice + surcharge + transport)
  const estimate = subtotal === null ? null : money(subtotal * (1 + shop.taxRate / 100))
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (submitting.current) return
    submitting.current = true
    try {
      if (!await confirm({ title: 'Send appointment request?', message: `Save your ${service.toLowerCase()} request for ${date} at ${time}?`, confirmLabel: 'Send request' })) return
      setBusy(true)
      await saveAppointment(user!, { service, device, preferredDate: date, preferredTime: time, notes, visit: { mode, address: mode === 'Workshop' ? '' : address, distanceKm: mode === 'Workshop' ? 0 : Number(distance), tier, basePrice, surcharge, transport, taxRate: shop.taxRate, estimate } })
      setOpen(false); setSubmitted(true)
    } catch (err) { setError((err as Error).message || 'Unable to save your request. Check your connection and try again.') }
    finally { submitting.current = false; setBusy(false) }
  }
  if (submitted) return <div className="success-state"><CheckCircle2 size={42} /><span className="eyebrow">REQUEST SENT</span><h1>Your appointment request is in.</h1><p>The workshop can review your request from its dashboard.</p><button className="primary-button" onClick={() => navigate('/customer/records?tab=appointments')}>View my appointments</button></div>
  return <><PageHeader eyebrow="SERVICES & BOOKING" title="Book a service" description="Visit the workshop or request a technician at home."><button className="primary-button" onClick={() => setOpen(true)}><CalendarDays size={18} />Start booking</button><Link className="secondary-button" to="/customer/services">Price catalog</Link></PageHeader>
    <div className="visit-options"><button className="visit-option" onClick={() => { setMode('Workshop'); setOpen(true) }}><MapPin size={30} /><strong>Visit the workshop</strong><span>Bring your device in for cleaning, diagnostics, or upgrades.</span><small>No transportation fee</small></button><button className="visit-option" onClick={() => { setMode('Home service'); setOpen(true) }}><House size={30} /><strong>Request home service</strong><span>Choose a schedule and share your address and distance.</span><small>Visit surcharge and transportation apply</small></button></div>
    {open && <Dialog title="Appointment details" wide onClose={() => setOpen(false)}><div className="booking-layout"><Panel title="Service request"><form id="service-booking" className="portal-form" onSubmit={submit}><div className="portal-form-grid">
      <label>Service requested<select value={service} onChange={e => setService(e.target.value)}>{services.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Device or model<input required maxLength={160} value={device} onChange={e => setDevice(e.target.value)} /></label>
      <label>Visit type<select value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option>Workshop</option><option>Home service</option></select></label>
      {service.includes('deep cleaning') && <label>Device spec tier<select value={tier} onChange={e => setTier(e.target.value as Tier)}>{tiers.map(tier => <option key={tier}>{tier}</option>)}</select></label>}
      <label>Preferred date<input required type="date" min={today()} value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Preferred time<select required value={time} onChange={e => setTime(e.target.value)}><option value="">Choose a time</option>{directory.times.map(time => <option key={time}>{time}</option>)}</select></label>
      {mode === 'Home service' && <><label>Home-service address<textarea required maxLength={400} rows={2} value={address} onChange={e => setAddress(e.target.value)} /></label><label>One-way road distance (km)<input required type="number" min="0.1" step="0.1" value={distance} onChange={e => setDistance(e.target.value)} /><small className="storage-caption">From the workshop; distance will be confirmed.</small></label></>}
    </div><label>What should we know?<textarea rows={3} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<p className="storage-caption">Schedule and final quote require confirmation.</p></form></Panel>
    <Panel className="estimate-card" title="Service estimate" action={mode === 'Home service' ? <House size={22} /> : <MapPin size={22} />}><dl className="checkout-totals">{[['Service base price', basePrice], ['Home-service surcharge', surcharge], ['Transportation', transport], ['Tax (' + shop.taxRate + '%)', subtotal === null ? null : money(subtotal * shop.taxRate / 100)], ['Estimated total', estimate]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value === null ? 'Quote required' : formatPHP(Number(value))}</dd></div>)}</dl><p className="storage-caption">{mode === 'Home service' ? 'Home service includes the service price, visit surcharge, and distance-based transportation.' : 'Workshop visits have no transportation or home-service surcharge.'} Unset prices will be quoted before confirmation.</p></Panel></div><div className="dialog-actions"><span className="booking-footer-total">Estimated total<strong>{estimate === null ? 'Quote required' : formatPHP(estimate)}</strong></span><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={busy} form="service-booking"><Send size={18}/>Send request</button></div></Dialog>}
  </>
}
