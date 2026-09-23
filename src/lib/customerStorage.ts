import { today } from './workspaceStorage'
import { readShopSettings } from './preferences'
import { optionalPrice, transportation } from './fulfillment'
import { money } from './commerce'
import type { AppUser, CustomerAppointment, CustomPcRequest } from '../types/business'

const appointmentsKey = (userId: string) => `jbc-rigworks:appointments:${userId}`
const requestsKey = (userId: string) => `jbc-rigworks:pc-requests:${userId}`

function read<T>(key: string): T[] {
  try {
    const value = localStorage.getItem(key)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function write<T>(key: string, value: T[]) {
  const previous = localStorage.getItem(key)
  if (previous) { try { if (!Array.isArray(JSON.parse(previous))) throw new Error() } catch { throw new Error('Saved requests are unreadable. Restore them before saving to protect the existing records.') } }
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new Event('jbc-requests-change'))
}

export const getAppointments = (user: AppUser) => read<CustomerAppointment>(appointmentsKey(user.id))
export const getPcRequests = (user: AppUser) => read<CustomPcRequest>(requestsKey(user.id))

export function saveAppointment(user: AppUser, appointment: Omit<CustomerAppointment, 'id' | 'createdAt' | 'status'>) {
  if (!appointment.device.trim() || !appointment.preferredTime || !/^\d{4}-\d{2}-\d{2}$/.test(appointment.preferredDate) || appointment.preferredDate < today()) throw new Error('Enter a device and a valid current or future appointment date and time.')
  if (appointment.visit) {
    const visit = appointment.visit
    if (visit.mode === 'Home service' && (!visit.address.trim() || !Number.isFinite(visit.distanceKm) || visit.distanceKm <= 0)) throw new Error('Enter your home address and a distance greater than zero.')
    const settings = readShopSettings()
    visit.basePrice = appointment.service.includes('deep cleaning') ? optionalPrice(settings.cleaning[appointment.service.startsWith('Laptop') ? 'Laptop' : 'Desktop'][visit.tier]) : null
    visit.surcharge = visit.mode === 'Workshop' ? 0 : optionalPrice(settings.homeSurcharge)
    visit.transport = visit.mode === 'Workshop' ? 0 : transportation(settings, visit.distanceKm)
    visit.taxRate = settings.taxRate
    visit.estimate = visit.basePrice === null || visit.surcharge === null || visit.transport === null ? null : money((visit.basePrice + visit.surcharge + visit.transport) * (1 + settings.taxRate / 100))
  }
  const record: CustomerAppointment = { ...appointment, customerName: user.name, customerEmail: user.email, shopId: localStorage.getItem('jbc-rigworks:shop-owner:v1') || undefined, id: `APT-${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), status: 'Requested' }
  write(appointmentsKey(user.id), [record, ...getAppointments(user)])
  return record
}

export function savePcRequest(user: AppUser, request: Omit<CustomPcRequest, 'id' | 'createdAt' | 'status'>) {
  const record: CustomPcRequest = { ...request, customerName: user.name, customerEmail: user.email, shopId: localStorage.getItem('jbc-rigworks:shop-owner:v1') || undefined, id: `PC-${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), status: 'Under review' }
  write(requestsKey(user.id), [record, ...getPcRequests(user)])
  return record
}
