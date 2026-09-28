import { runTransaction, setDoc } from 'firebase/firestore'
import { firestoreData, recordRef, shopRef } from '../../lib/database'
import { today } from '../../lib/dates'
import { firebaseFirestore } from '../../lib/firebase'
import { defaultShop, normalizeShop } from '../../lib/shopSettings'
import type {
  AppUser,
  CustomerAppointment,
  CustomPcRequest,
  InventoryItem,
  ServiceIntake,
} from '../../types'
import { reviewBuild } from '../builder/buildReview'
import {
  availableWindows,
  slotKey,
  slotLabel,
  slotWithHold,
  slotWithoutHold,
  type AppointmentSlot,
} from '../services/serviceCatalog'
import { priceVisit } from '../services/visitPricing'
import { intakeTypeForService, validateServiceIntake } from './serviceIntake'

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
  updates: {
    notes: string
    preferredDate?: string
    preferredTime?: string
    device?: string
    specifications?: string
    unknownSpecifications?: boolean
    serviceIntake?: ServiceIntake
    visitAddress?: string
  } | null,
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
      !(kind === 'appointments'
        ? request.status === 'Requested' && !('reviewNote' in request && request.reviewNote)
        : request.status === 'Quote requested')
    )
      throw new Error('This request is being processed. Reopen it to see the current status.')
    if (!updates) {
      const slot =
        'slotId' in request && request.slotId
          ? await transaction.get(recordRef('appointmentSlots', request.slotId))
          : null
      if (slot?.exists() && (slot.data() as AppointmentSlot).holds?.[request.id])
        transaction.set(slot.ref, slotWithoutHold(slot.data() as AppointmentSlot, request.id))
      transaction.update(ref, {
        status: 'Cancelled',
        cancelledBy: user.id,
        cancelledAt: new Date().toISOString(),
      })
      return null
    }
    if (
      'preferredDate' in request &&
      (!updates.preferredDate || updates.preferredDate < today() || !updates.preferredTime)
    )
      throw new Error('Select a current or future date and a time.')
    let nextSlot: Awaited<ReturnType<typeof transaction.get>> | null = null
    let previousSlot: Awaited<ReturnType<typeof transaction.get>> | null = null
    let nextSlotId = ''
    let changedIntake: ServiceIntake | undefined
    if ('preferredDate' in request) {
      const settingsDoc = await transaction.get(shopRef),
        settings = normalizeShop(settingsDoc.data() ?? {})
      if (!updates.device?.trim()) throw new Error('Enter the device brand and model.')
      changedIntake = validateServiceIntake({
        ...(updates.serviceIntake ?? request.serviceIntake),
        serviceType: intakeTypeForService(request.serviceId, request.service),
      } as ServiceIntake)
      const visit =
        request.visit?.mode === 'Home service'
          ? { ...request.visit, address: updates.visitAddress?.trim() ?? request.visit.address }
          : request.visit
      if (visit?.mode === 'Home service' && !visit.address)
        throw new Error('Enter the home-service address.')
      const window = settings.schedule.windows.find(
        (slot) => slotLabel(slot) === updates.preferredTime,
      )
      nextSlotId = window ? slotKey(updates.preferredDate!, window.id) : ''
      nextSlot = window ? await transaction.get(recordRef('appointmentSlots', nextSlotId)) : null
      previousSlot =
        request.slotId && request.slotId !== nextSlotId
          ? await transaction.get(recordRef('appointmentSlots', request.slotId))
          : null
      const existing = nextSlot?.data() as AppointmentSlot | undefined
      const holdsSame = !!existing?.holds?.[request.id]
      if (
        !window ||
        (!holdsSame &&
          !availableWindows(
            updates.preferredDate!,
            settings.schedule,
            [{ id: nextSlotId, count: Math.max(0, (existing?.count ?? 0) - (holdsSame ? 1 : 0)) }],
            settings.services.find((service) => service.id === request.serviceId)?.durationMinutes,
          ).some((slot) => slot.id === window.id))
      )
        throw new Error('Choose an available appointment window.')
    }
    const changed = {
      ...request,
      notes: updates.notes,
      ...('preferredDate' in request
        ? {
            preferredDate: updates.preferredDate,
            preferredTime: updates.preferredTime,
            device: updates.device!.trim(),
            specifications: updates.specifications?.trim() ?? request.specifications,
            unknownSpecifications: updates.unknownSpecifications ?? request.unknownSpecifications,
            serviceIntake: changedIntake,
            visit:
              request.visit?.mode === 'Home service'
                ? {
                    ...request.visit,
                    address: updates.visitAddress?.trim() ?? request.visit.address,
                  }
                : request.visit,
            slotId: nextSlotId,
          }
        : {}),
    }
    if ('preferredDate' in request && nextSlot && nextSlotId !== request.slotId) {
      if (previousSlot?.exists() && (previousSlot.data() as AppointmentSlot).holds?.[request.id])
        transaction.set(
          previousSlot.ref,
          slotWithoutHold(previousSlot.data() as AppointmentSlot, request.id),
        )
      const windowId = nextSlotId.slice(updates.preferredDate!.length + 1)
      transaction.set(
        nextSlot.ref,
        slotWithHold(
          nextSlot.data() as AppointmentSlot | undefined,
          updates.preferredDate!,
          windowId,
          request.id,
          user.id,
        ),
      )
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
  const id = `APT-${crypto.randomUUID()}`
  return runTransaction(firebaseFirestore, async (tx) => {
    const settingsDoc = await tx.get(shopRef)
    const settings = normalizeShop(settingsDoc.exists() ? settingsDoc.data() : defaultShop)
    const offering = settings.services.find((service) => service.id === appointment.serviceId)
    if (
      !offering?.active ||
      !(appointment.visit?.mode === 'Home service' ? offering.home : offering.workshop)
    )
      throw new Error('Choose an available service and visit location.')
    const window = settings.schedule.windows.find(
      (slot) => slotLabel(slot) === appointment.preferredTime,
    )
    const slotRef = window
      ? recordRef('appointmentSlots', slotKey(appointment.preferredDate, window.id))
      : null
    const slot = slotRef ? await tx.get(slotRef) : null
    const current = slot?.data() as AppointmentSlot | undefined
    if (
      !window ||
      !availableWindows(
        appointment.preferredDate,
        settings.schedule,
        current ? [{ id: current.id, count: current.count }] : [],
        offering.durationMinutes,
      ).some((value) => value.id === window.id)
    )
      throw new Error('That time is now booked. Choose another appointment window.')
    const visit = priceVisit(appointment, settings)
    const serviceIntake = appointment.visit
      ? validateServiceIntake(appointment.serviceIntake)
      : undefined
    const record: CustomerAppointment = {
      ...appointment,
      schemaVersion: 2,
      visit,
      serviceIntake,
      slotId: slotRef!.id,
      customerId: user.id,
      customerName: serviceIntake?.customerName || user.name,
      customerEmail: user.email,
      id,
      createdAt: new Date().toISOString(),
      status: 'Requested',
    }
    tx.set(recordRef('appointments', id), firestoreData(record))
    tx.set(slotRef!, slotWithHold(current, appointment.preferredDate, window.id, id, user.id))
    return record
  })
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

export async function updatePendingPcRequest(
  user: AppUser,
  requestId: string,
  changes: Pick<
    CustomPcRequest,
    | 'parts'
    | 'tier'
    | 'useCase'
    | 'budget'
    | 'processor'
    | 'graphics'
    | 'memory'
    | 'storage'
    | 'notes'
  >,
) {
  if (!changes.parts?.length) throw new Error('Select at least one part.')
  const ref = recordRef('pcRequests', requestId)
  return runTransaction(firebaseFirestore, async (transaction) => {
    const snapshot = await transaction.get(ref)
    const current = snapshot.exists() ? (snapshot.data() as CustomPcRequest) : null
    if (!current || current.customerId !== user.id || current.status !== 'Quote requested')
      throw new Error(
        'This pre-order is already under workshop review and can no longer be edited.',
      )
    transaction.update(ref, firestoreData(changes))
    return { ...current, ...changes }
  })
}
