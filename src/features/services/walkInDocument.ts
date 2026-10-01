import type { CustomerAppointment, Job } from '../../types'

export function walkInDocumentAppointment(job: Job): CustomerAppointment {
  const intakeDate = job.confirmedAt
    ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(job.confirmedAt))
    : job.due
  return {
    id: job.id,
    serviceId: job.serviceId,
    service: job.service,
    device: job.device,
    preferredDate: intakeDate,
    preferredTime: 'Walk-in',
    notes: job.concern ?? '',
    status: 'Confirmed',
    createdAt: job.confirmedAt ?? new Date().toISOString(),
    customerName: job.customer,
    serviceIntake: job.serviceIntake,
    selectedCharges: job.selectedCharges,
  }
}

export function jobDocumentAppointment(job: Job): CustomerAppointment {
  return {
    id: job.appointmentId ?? job.id,
    serviceId: job.serviceId,
    service: job.service,
    device: job.device,
    preferredDate: job.due,
    preferredTime: '',
    notes: job.concern ?? job.intakeNotes ?? '',
    status: 'Completed',
    createdAt: job.confirmedAt ?? new Date().toISOString(),
    customerName: job.customer,
    serviceIntake: job.serviceIntake,
    selectedCharges: job.selectedCharges,
  }
}
