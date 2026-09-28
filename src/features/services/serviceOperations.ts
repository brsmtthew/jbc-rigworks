import { runTransaction } from 'firebase/firestore'
import { firestoreData, recordRef, shopRef } from '../../lib/database'
import { firebaseFirestore } from '../../lib/firebase'
import { normalizeShop } from '../../lib/shopSettings'
import { assertTransition, serviceState, serviceTransitions } from '../../lib/workflow'
import type { AppUser, CustomerAppointment, Job, ServiceStatus } from '../../types'
import {
  availableWindows,
  slotKey,
  slotLabel,
  slotWithHold,
  slotWithoutHold,
  type AppointmentSlot,
} from './serviceCatalog'
import { priceVisit } from './visitPricing'

export async function updateAppointmentStatus(user: AppUser, id: string, status: ServiceStatus) {
  if (user.role !== 'admin') throw new Error('Only JBC can confirm an appointment.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const ref = recordRef('appointments', id)
    const [snapshot, settingsDoc] = await Promise.all([tx.get(ref), tx.get(shopRef)])
    if (!snapshot.exists()) throw new Error('Appointment unavailable.')
    const appointment = snapshot.data() as CustomerAppointment
    assertTransition(serviceTransitions, appointment.status, status)
    if (!['Confirmed', 'Cancelled', 'No show'].includes(status))
      throw new Error('Use the linked service job for this action.')
    const updated = { ...appointment, status }
    if (status === 'Confirmed') {
      const settings = normalizeShop(settingsDoc.data() ?? {})
      if (appointment.serviceId) {
        const offering = settings.services.find(
          (service) => service.id === appointment.serviceId && service.active,
        )
        if (!offering)
          throw new Error(
            'This service is no longer available. Review the booking with the customer.',
          )
        updated.service = `${offering.name} / ${offering.deviceType}`
        updated.visit = priceVisit(appointment, settings)
      }
      const window = settings.schedule.windows.find(
        (slot) => slotLabel(slot) === appointment.preferredTime,
      )
      if (!window)
        throw new Error(
          'This older appointment needs a current schedule window. Ask the customer to reschedule it before confirmation.',
        )
      const slotRef = recordRef('appointmentSlots', slotKey(appointment.preferredDate, window.id)),
        slot = await tx.get(slotRef)
      const current = slot.data() as AppointmentSlot | undefined
      const holdsSameSlot = !!current?.holds?.[appointment.id]
      const count = Math.max(0, (current?.count ?? 0) - (holdsSameSlot ? 1 : 0))
      if (
        !availableWindows(
          appointment.preferredDate,
          settings.schedule,
          [{ id: slotRef.id, count }],
          settings.services.find((service) => service.id === appointment.serviceId)
            ?.durationMinutes,
        ).some((value) => value.id === window.id)
      )
        throw new Error('This appointment time is full or unavailable.')
      if (!holdsSameSlot)
        tx.set(
          slotRef,
          slotWithHold(
            current,
            appointment.preferredDate,
            window.id,
            appointment.id,
            appointment.customerId ?? 'admin',
          ),
        )
      updated.slotId = slotRef.id
    } else {
      if (appointment.slotId) {
        const slot = await tx.get(recordRef('appointmentSlots', appointment.slotId))
        if (slot.exists()) {
          const current = slot.data() as AppointmentSlot
          tx.set(
            slot.ref,
            current.holds?.[appointment.id]
              ? slotWithoutHold(current, appointment.id)
              : { ...current, count: Math.max(0, current.count - 1) },
          )
        }
      }
      updated.cancelledAt = new Date().toISOString()
      updated.cancelledBy = user.id
    }
    tx.set(ref, firestoreData(updated))
    return updated
  })
}
export async function reviewAppointment(
  user: AppUser,
  id: string,
  review: { date: string; time: string; estimate?: number; note: string },
) {
  if (user.role !== 'admin') throw new Error('Only the workshop can review appointments.')
  if (
    !review.note.trim() ||
    review.note.length > 1000 ||
    (review.estimate !== undefined && (!Number.isFinite(review.estimate) || review.estimate < 0))
  )
    throw new Error('Enter a review note and a valid estimate before tax.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const ref = recordRef('appointments', id)
    const [snapshot, settingsDoc] = await Promise.all([tx.get(ref), tx.get(shopRef)])
    const appointment = snapshot.data() as CustomerAppointment | undefined
    if (
      !appointment ||
      !['Requested', 'Confirmed'].includes(appointment.status) ||
      appointment.jobId
    )
      throw new Error('This appointment has already progressed. Review its service job instead.')
    const settings = normalizeShop(settingsDoc.data() ?? {})
    const window = settings.schedule.windows.find((slot) => slotLabel(slot) === review.time)
    if (!window) throw new Error('Select a current appointment window.')
    const nextRef = recordRef('appointmentSlots', slotKey(review.date, window.id))
    const [nextSlot, previousSlot] = await Promise.all([
      tx.get(nextRef),
      appointment.slotId && appointment.slotId !== nextRef.id
        ? tx.get(recordRef('appointmentSlots', appointment.slotId))
        : Promise.resolve(null),
    ])
    const nextCurrent = nextSlot.data() as AppointmentSlot | undefined
    const holdsSameSlot = !!nextCurrent?.holds?.[appointment.id]
    const ownsLegacySlot =
      appointment.status === 'Confirmed' && appointment.slotId === nextRef.id && !holdsSameSlot
    const count = nextCurrent?.count ?? 0
    const counts = [
      { id: nextRef.id, count: Math.max(0, count - (holdsSameSlot || ownsLegacySlot ? 1 : 0)) },
    ]
    if (
      !availableWindows(
        review.date,
        settings.schedule,
        counts,
        settings.services.find((service) => service.id === appointment.serviceId)?.durationMinutes,
      ).some((slot) => slot.id === window.id)
    )
      throw new Error('This appointment time is full or unavailable.')
    const updated: CustomerAppointment = {
      ...appointment,
      preferredDate: review.date,
      preferredTime: review.time,
      reviewedEstimate: review.estimate,
      reviewNote: review.note.trim(),
      scheduleHistory: [
        ...(appointment.scheduleHistory ?? []),
        {
          at: new Date().toISOString(),
          by: user.id,
          date: appointment.preferredDate,
          time: appointment.preferredTime,
          estimate: appointment.reviewedEstimate,
          note: review.note.trim(),
        },
      ],
    }
    if (previousSlot?.exists()) {
      const previous = previousSlot.data() as AppointmentSlot
      if (previous.holds?.[appointment.id])
        tx.set(previousSlot.ref, slotWithoutHold(previous, appointment.id))
      else if (appointment.status === 'Confirmed')
        tx.set(previousSlot.ref, { ...previous, count: Math.max(0, previous.count - 1) })
    }
    if (!holdsSameSlot) {
      const held = slotWithHold(
        nextCurrent,
        review.date,
        window.id,
        appointment.id,
        appointment.customerId ?? 'admin',
      )
      tx.set(nextRef, ownsLegacySlot ? { ...held, count } : held)
    }
    updated.slotId = nextRef.id
    tx.set(ref, firestoreData(updated))
    return updated
  })
}
export async function receiveAppointmentAsJob(user: AppUser, id: string) {
  if (user.role !== 'admin') throw new Error('Only the workshop can check in a device.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const appointmentRef = recordRef('appointments', id),
      jobRef = recordRef('jobs', `JOB-${id}`)
    const [snapshot, existing] = await Promise.all([tx.get(appointmentRef), tx.get(jobRef)])
    if (existing.exists()) return existing.data() as Job
    const appointment = snapshot.data() as CustomerAppointment | undefined
    if (!appointment || appointment.status !== 'Confirmed')
      throw new Error('Confirm the appointment before starting service.')
    if (appointment.visit && !appointment.intakeSignedAt)
      throw new Error(
        'Review the paper device intake and collect signatures before starting service.',
      )
    const status: ServiceStatus =
      appointment.visit?.mode === 'Home service' ? 'In service' : 'Checked in'
    const visit = appointment.visit
    const quote =
      appointment.reviewedEstimate ??
      (visit && visit.basePrice !== null && visit.surcharge !== null && visit.transport !== null
        ? visit.basePrice + visit.surcharge + visit.transport
        : 0)
    const job: Job = {
      schemaVersion: 2,
      id: jobRef.id,
      customer: appointment.customerName ?? 'Customer',
      customerId: appointment.customerId,
      contact: appointment.customerEmail,
      appointmentId: id,
      device: appointment.device,
      service: appointment.service,
      due: appointment.preferredDate,
      quote,
      status,
      paymentStatus: 'Unpaid',
      concern: appointment.notes,
    }
    tx.set(jobRef, firestoreData(job))
    tx.update(appointmentRef, { status, jobId: job.id })
    return job
  })
}
export async function recordSignedServiceIntake(user: AppUser, id: string) {
  if (user.role !== 'admin') throw new Error('Only JBC can record a signed intake.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const ref = recordRef('appointments', id)
    const snapshot = await tx.get(ref)
    const appointment = snapshot.data() as CustomerAppointment | undefined
    if (
      !appointment ||
      !appointment.visit ||
      appointment.status !== 'Confirmed' ||
      appointment.jobId
    )
      throw new Error('Confirm the appointment before recording the signed intake.')
    if (appointment.intakeSignedAt) return appointment
    const signedAt = new Date().toISOString()
    tx.update(ref, { intakeSignedAt: signedAt, intakeSignedBy: user.id })
    return { ...appointment, intakeSignedAt: signedAt, intakeSignedBy: user.id }
  })
}
export async function advanceService(user: AppUser, id: string, next: ServiceStatus) {
  if (user.role !== 'admin') throw new Error('Only the workshop can update service work.')
  return runTransaction(firebaseFirestore, async (tx) => {
    const ref = recordRef('jobs', id),
      snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('Service unavailable.')
    const job = snapshot.data() as Job
    assertTransition(serviceTransitions, serviceState(job.status), next)
    if (next === 'Completed' && job.paymentStatus !== 'Paid')
      throw new Error('Collect payment through POS before releasing the device.')
    if (next === 'Ready for checkout' && (!Number.isFinite(job.quote) || job.quote <= 0))
      throw new Error('Enter the final approved quote before checkout.')
    tx.update(ref, { status: next })
    if (job.appointmentId) tx.update(recordRef('appointments', job.appointmentId), { status: next })
    if (next === 'Completed' && job.transactionId) {
      tx.update(recordRef('sales', job.transactionId), { orderStatus: 'Completed' })
      if (job.customerId)
        tx.update(recordRef('orders', job.transactionId), { orderStatus: 'Completed' })
    }
  })
}

export async function saveServiceJob(user: AppUser, record: Job) {
  if (user.role !== 'admin') throw new Error('Only the workshop can update services.')
  await runTransaction(firebaseFirestore, async (transaction) => {
    const ref = recordRef('jobs', record.id),
      snapshot = await transaction.get(ref)
    const current = snapshot.data() as Job | undefined,
      draft = record
    if (!Number.isFinite(draft.quote) || draft.quote < 0)
      throw new Error('Enter a valid service price.')
    if (
      current &&
      (current.paymentStatus === 'Paid' || serviceState(current.status) === 'Completed')
    )
      throw new Error('Paid or completed services cannot be edited.')
    transaction.set(
      ref,
      firestoreData({
        ...draft,
        ...(current
          ? {
              status: current.status,
              paymentStatus: current.paymentStatus,
              transactionId: current.transactionId,
              appointmentId: current.appointmentId,
              customerId: current.customerId,
            }
          : { status: 'Checked in', paymentStatus: 'Unpaid', schemaVersion: 2 }),
      }),
    )
  })
}
