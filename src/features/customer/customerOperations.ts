import { getDocFromServer, runTransaction, setDoc } from 'firebase/firestore'
import { firestoreData, recordRef, shopRef } from '../../lib/database'
import { today } from '../../lib/dates'
import { firebaseFirestore } from '../../lib/firebase'
import { defaultShop, normalizeShop } from '../../lib/shopSettings'
import type { AppUser, CustomerAppointment, CustomPcRequest, InventoryItem } from '../../types'
import { reviewBuild } from '../builder/buildReview'
import { availableWindows, slotKey, slotLabel } from '../services/serviceCatalog'
import { priceVisit } from '../services/visitPricing'
import { validateServiceIntake } from './serviceIntake'

export async function savePcQuote(
  user: AppUser,
  customerId: string,
  requestId: string,
  quote: { amount: number; message: string },
) {
  if (user.role !== 'admin') throw new Error('Only the workshop can prepare a quote.')
  if (!Number.isFinite(quote.amount) || quote.amount < 0 || !quote.message.trim())
    throw new Error('Enter a valid quote amount and message.')
  const ref = recordRef('pcRequests', requestId)
  return runTransaction(firebaseFirestore, async (transaction) => {
    const snapshot = await transaction.get(ref)
    const request = snapshot.exists() ? (snapshot.data() as CustomPcRequest) : null
    if (
      !request ||
      request.customerId !== customerId ||
      !['Quote requested', 'Under review', 'Quoted'].includes(request.status)
    )
      throw new Error('This request is no longer available for quoting.')
    const inventoryIds = [
      ...new Set(
        (request.parts ?? [])
          .filter((part) => ['Stock', 'inventory'].includes(part.source) && part.inventoryId)
          .map((part) => part.inventoryId!),
      ),
    ]
    const items = await Promise.all(
      inventoryIds.map((id) => transaction.get(recordRef('inventory', id))),
    )
    if (
      reviewBuild(
        request,
        items.filter((item) => item.exists()).map((item) => item.data() as InventoryItem),
      ).errors.length
    )
      throw new Error('Resolve the known compatibility conflicts before quoting this build.')
    const updated: CustomPcRequest = {
      ...request,
      quote: { ...quote, message: quote.message.trim(), createdAt: new Date().toISOString() },
      status: 'Quoted',
    }
    transaction.set(ref, firestoreData(updated))
    return updated
  })
}

export async function respondToPcQuote(
  user: AppUser,
  requestId: string,
  response: 'Approved' | 'Declined',
) {
  if (user.role !== 'user') throw new Error('Only the customer can respond to this quote.')
  const ref = recordRef('pcRequests', requestId)
  return runTransaction(firebaseFirestore, async (transaction) => {
    const snapshot = await transaction.get(ref)
    const request = snapshot.exists() ? (snapshot.data() as CustomPcRequest) : null
    if (!request || request.customerId !== user.id || request.status !== 'Quoted' || !request.quote)
      throw new Error('This quote is no longer available. Refresh your records and try again.')
    const updated = { ...request, status: response }
    transaction.set(ref, firestoreData(updated))
    return updated
  })
}

export async function changePendingRequest(
  user: AppUser,
  kind: 'appointments' | 'requests',
  id: string,
  updates: { notes: string; preferredDate?: string; preferredTime?: string } | null,
) {
  const ref = recordRef(kind === 'appointments' ? 'appointments' : 'pcRequests', id)
  return runTransaction(firebaseFirestore, async (transaction) => {
    const snapshot = await transaction.get(ref)
    const request = snapshot.exists()
      ? (snapshot.data() as CustomerAppointment | CustomPcRequest)
      : null
    if (
      !request ||
      request.customerId !== user.id ||
      !['Requested', 'Quote requested', 'Under review'].includes(request.status)
    )
      throw new Error('This request is being processed. Reopen it to see the current status.')
    if (!updates) {
      if ('slotId' in request && request.slotId) {
        const slot = await transaction.get(recordRef('appointmentSlots', request.slotId))
        if (slot.exists())
          transaction.update(slot.ref, { count: Math.max(0, slot.data().count - 1) })
      }
      transaction.update(ref, {
        status: 'Cancelled',
        cancelledBy: user.id,
        cancelledAt: new Date().toISOString(),
      })
      return null
    }
    if (request.status === 'Confirmed')
      throw new Error('Contact JBC to reschedule a confirmed appointment.')
    if (
      'preferredDate' in request &&
      (!updates.preferredDate || updates.preferredDate < today() || !updates.preferredTime)
    )
      throw new Error('Select a current or future date and a time.')
    if ('preferredDate' in request) {
      const settingsDoc = await transaction.get(shopRef),
        settings = normalizeShop(settingsDoc.data() ?? {})
      const window = settings.schedule.windows.find(
        (slot) => slotLabel(slot) === updates.preferredTime,
      )
      const slot = window
        ? await transaction.get(
            recordRef('appointmentSlots', slotKey(updates.preferredDate!, window.id)),
          )
        : null
      if (
        !window ||
        !availableWindows(
          updates.preferredDate!,
          settings.schedule,
          slot?.exists() ? [{ id: slot.id, count: slot.data().count }] : [],
          settings.services.find((service) => service.id === request.serviceId)?.durationMinutes,
        ).some((slot) => slot.id === window.id)
      )
        throw new Error('Choose an available appointment window.')
    }
    const changed = {
      ...request,
      notes: updates.notes,
      ...('preferredDate' in request
        ? { preferredDate: updates.preferredDate, preferredTime: updates.preferredTime }
        : {}),
    }
    transaction.set(ref, firestoreData(changed))
    return changed
  })
}

export async function saveAppointment(
  user: AppUser,
  appointment: Omit<CustomerAppointment, 'id' | 'createdAt' | 'status'>,
) {
  if (
    !appointment.device.trim() ||
    !appointment.preferredTime ||
    !/^\d{4}-\d{2}-\d{2}$/.test(appointment.preferredDate) ||
    appointment.preferredDate < today()
  )
    throw new Error('Enter a device and a valid current or future appointment date and time.')
  const shopSnapshot = await getDocFromServer(shopRef)
  const settings = normalizeShop(shopSnapshot.exists() ? shopSnapshot.data() : defaultShop)
  const offering = settings.services.find((service) => service.id === appointment.serviceId)
  if (!offering?.active) throw new Error('Choose an available service.')
  const window = settings.schedule.windows.find(
    (slot) => slotLabel(slot) === appointment.preferredTime,
  )
  const slot = window
    ? await getDocFromServer(
        recordRef('appointmentSlots', slotKey(appointment.preferredDate, window.id)),
      )
    : null
  if (
    !window ||
    !availableWindows(
      appointment.preferredDate,
      settings.schedule,
      slot?.exists() ? [{ id: slot.id, count: slot.data().count }] : [],
      offering.durationMinutes,
    ).some((value) => value.id === window.id)
  )
    throw new Error('That time is no longer available. Choose another appointment window.')
  const visit = priceVisit(appointment, settings)
  const serviceIntake = appointment.visit
    ? validateServiceIntake(appointment.serviceIntake)
    : undefined
  const id = `APT-${crypto.randomUUID()}`
  const record: CustomerAppointment = {
    ...appointment,
    schemaVersion: 2,
    visit,
    serviceIntake,
    customerId: user.id,
    customerName: serviceIntake?.customerName || user.name,
    customerEmail: user.email,
    id,
    createdAt: new Date().toISOString(),
    status: 'Requested',
  }
  await setDoc(recordRef('appointments', id), firestoreData(record))
  return record
}

export async function savePcRequest(
  user: AppUser,
  request: Omit<CustomPcRequest, 'id' | 'createdAt' | 'status'>,
) {
  const id = `PC-${crypto.randomUUID()}`
  const record: CustomPcRequest = {
    ...request,
    customerId: user.id,
    customerName: user.name,
    customerEmail: user.email,
    id,
    createdAt: new Date().toISOString(),
    status: 'Quote requested',
    schemaVersion: 2,
    reservationState: 'None',
  }
  await setDoc(recordRef('pcRequests', id), firestoreData(record))
  return record
}
