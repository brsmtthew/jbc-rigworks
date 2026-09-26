import { getDocFromServer, runTransaction, setDoc, where } from 'firebase/firestore'
import { today } from './workspaceStorage'
import { defaultShop, normalizeShop, type ShopSettings } from './preferences'
import { optionalPrice, transportation } from './fulfillment'
import { money } from './commerce'
import { firestoreData, recordRef, shopRef, useLiveCollection } from './database'
import { firebaseFirestore } from './firebase'
import type { AppUser, CustomerAppointment, CustomPcRequest, Job } from '../types/business'

function priceVisit(appointment: Pick<CustomerAppointment, 'service' | 'visit'>, settings: ShopSettings) {
  if (!appointment.visit) return undefined
  const visit = { ...appointment.visit }
  if (!['Workshop', 'Home service'].includes(visit.mode) || !['Low', 'Mid', 'High'].includes(visit.tier)) throw new Error('Select a valid visit type and device tier.')
  if (visit.mode === 'Home service' && (typeof visit.address !== 'string' || !visit.address.trim() || !Number.isFinite(visit.distanceKm) || visit.distanceKm <= 0)) throw new Error('Enter your home address and a distance greater than zero.')
  visit.basePrice = appointment.service.includes('deep cleaning') ? optionalPrice(settings.cleaning[appointment.service.startsWith('Laptop') ? 'Laptop' : 'Desktop'][visit.tier]) : null
  visit.surcharge = visit.mode === 'Workshop' ? 0 : optionalPrice(settings.homeSurcharge)
  visit.transport = visit.mode === 'Workshop' ? 0 : transportation(settings, visit.distanceKm)
  visit.taxRate = settings.taxRate
  visit.estimate = visit.basePrice === null || visit.surcharge === null || visit.transport === null ? null : money((visit.basePrice + visit.surcharge + visit.transport) * (1 + settings.taxRate / 100))
  return visit
}

export function useCustomerRequests(user: AppUser | null) {
  const appointments = useLiveCollection<CustomerAppointment>('appointments', !!user, [where('customerId', '==', user?.id ?? '')], user?.id)
  const requests = useLiveCollection<CustomPcRequest>('pcRequests', !!user, [where('customerId', '==', user?.id ?? '')], user?.id)
  return { appointments: appointments.rows, requests: requests.rows, error: appointments.error || requests.error, loading: appointments.loading || requests.loading }
}

export function useAllRequests(enabled: boolean) {
  const appointments = useLiveCollection<CustomerAppointment>('appointments', enabled)
  const requests = useLiveCollection<CustomPcRequest>('pcRequests', enabled)
  return { appointments: appointments.rows, requests: requests.rows, error: appointments.error || requests.error, loading: appointments.loading || requests.loading }
}

export async function savePcQuote(user: AppUser, customerId: string, requestId: string, quote: { amount: number; message: string }) {
  if (user.role !== 'admin') throw new Error('Only the workshop can prepare a quote.')
  if (!Number.isFinite(quote.amount) || quote.amount < 0 || !quote.message.trim()) throw new Error('Enter a valid quote amount and message.')
  const ref = recordRef('pcRequests', requestId)
  return runTransaction(firebaseFirestore, async transaction => {
    const snapshot = await transaction.get(ref)
    const request = snapshot.exists() ? snapshot.data() as CustomPcRequest : null
    if (!request || request.customerId !== customerId || !['Under review', 'Quoted'].includes(request.status)) throw new Error('This request is no longer available for quoting.')
    const updated: CustomPcRequest = { ...request, quote: { ...quote, message: quote.message.trim(), createdAt: new Date().toISOString() }, status: 'Quoted' }
    transaction.set(ref, firestoreData(updated))
    return updated
  })
}

export async function respondToPcQuote(user: AppUser, requestId: string, response: 'Approved' | 'Declined') {
  if (user.role !== 'user') throw new Error('Only the customer can respond to this quote.')
  const ref = recordRef('pcRequests', requestId)
  return runTransaction(firebaseFirestore, async transaction => {
    const snapshot = await transaction.get(ref)
    const request = snapshot.exists() ? snapshot.data() as CustomPcRequest : null
    if (!request || request.customerId !== user.id || request.status !== 'Quoted' || !request.quote) throw new Error('This quote is no longer available. Refresh your records and try again.')
    const updated = { ...request, status: response }
    transaction.set(ref, firestoreData(updated))
    return updated
  })
}

export async function updateAppointmentStatus(user: AppUser, appointmentId: string, status: CustomerAppointment['status']) {
  if (user.role !== 'admin') throw new Error('Only the workshop can update appointments.')
  const ref = recordRef('appointments', appointmentId)
  return runTransaction(firebaseFirestore, async transaction => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('This request is no longer available.')
    const updated = { ...snapshot.data() as CustomerAppointment, status }
    transaction.set(ref, firestoreData(updated))
    return updated
  })
}

export async function receiveAppointmentAsJob(user: AppUser, appointmentId: string) {
  if (user.role !== 'admin') throw new Error('Only the workshop can receive appointments.')
  const appointmentRef = recordRef('appointments', appointmentId)
  const jobRef = recordRef('jobs', 'JOB-' + appointmentId)
  return runTransaction(firebaseFirestore, async transaction => {
    const [appointmentSnapshot, jobSnapshot, shopSnapshot] = await Promise.all([transaction.get(appointmentRef), transaction.get(jobRef), transaction.get(shopRef)])
    const appointment = appointmentSnapshot.exists() ? appointmentSnapshot.data() as CustomerAppointment : null
    if (!appointment || !['Requested', 'Confirmed'].includes(appointment.status)) throw new Error('Only a requested or confirmed booking can become a service job.')
    if (jobSnapshot.exists()) throw new Error('This request already has a service job.')
    const visit = priceVisit(appointment, normalizeShop(shopSnapshot.exists() ? shopSnapshot.data() : defaultShop))
    const job: Job = {
      id: jobRef.id,
      customer: appointment.customerName || appointment.customerId || 'Customer',
      device: appointment.device,
      service: appointment.service + (appointment.visit?.mode === 'Home service' ? ' / Home service: ' + appointment.visit.address : ''),
      due: appointment.preferredDate,
      quote: visit?.estimate || 0,
      status: 'Queued',
    }
    transaction.set(jobRef, firestoreData(job))
    transaction.set(appointmentRef, firestoreData({ ...appointment, visit, status: 'Confirmed' }))
    return job
  })
}

export async function changePendingRequest(user: AppUser, kind: 'appointments' | 'requests', id: string, updates: { notes: string; preferredDate?: string; preferredTime?: string } | null) {
  const ref = recordRef(kind === 'appointments' ? 'appointments' : 'pcRequests', id)
  return runTransaction(firebaseFirestore, async transaction => {
    const snapshot = await transaction.get(ref)
    const request = snapshot.exists() ? snapshot.data() as CustomerAppointment | CustomPcRequest : null
    if (!request || request.customerId !== user.id || !['Requested', 'Under review'].includes(request.status)) throw new Error('This request is being processed. Reopen it to see the current status.')
    if (!updates) { transaction.delete(ref); return null }
    if ('preferredDate' in request && (!updates.preferredDate || updates.preferredDate < today() || !updates.preferredTime)) throw new Error('Select a current or future date and a time.')
    const changed = { ...request, notes: updates.notes, ...('preferredDate' in request ? { preferredDate: updates.preferredDate, preferredTime: updates.preferredTime } : {}) }
    transaction.set(ref, firestoreData(changed))
    return changed
  })
}

export async function saveAppointment(user: AppUser, appointment: Omit<CustomerAppointment, 'id' | 'createdAt' | 'status'>) {
  if (!appointment.device.trim() || !appointment.preferredTime || !/^\d{4}-\d{2}-\d{2}$/.test(appointment.preferredDate) || appointment.preferredDate < today()) throw new Error('Enter a device and a valid current or future appointment date and time.')
  const shopSnapshot = await getDocFromServer(shopRef)
  const settings = normalizeShop(shopSnapshot.exists() ? shopSnapshot.data() : defaultShop)
  const visit = priceVisit(appointment, settings)
  const id = `APT-${crypto.randomUUID()}`
  const record: CustomerAppointment = { ...appointment, visit, customerId: user.id, customerName: user.name, customerEmail: user.email, id, createdAt: new Date().toISOString(), status: 'Requested' }
  await setDoc(recordRef('appointments', id), firestoreData(record))
  return record
}

export async function savePcRequest(user: AppUser, request: Omit<CustomPcRequest, 'id' | 'createdAt' | 'status'>) {
  const id = `PC-${crypto.randomUUID()}`
  const record: CustomPcRequest = { ...request, customerId: user.id, customerName: user.name, customerEmail: user.email, id, createdAt: new Date().toISOString(), status: 'Under review' }
  await setDoc(recordRef('pcRequests', id), firestoreData(record))
  return record
}
