import type { CustomerAppointment, ServiceIntake } from '../../types'

export const damageOptions = [
  'No visible damage', 'Scratches', 'Dents', 'Cracks', 'Damaged ports',
  'Missing screws', 'Broken clips / panels', 'Damaged cables', 'Corrosion',
] as const

export const emptyServiceIntake: ServiceIntake = {
  customerName: '', contactPhone: '', socialHandle: '', deviceType: 'Desktop PC',
  cpu: '', gpu: '', ram: '', storage: '', motherboard: '', psuOrCharger: '', cooling: '',
  serialNumber: '', accessories: '', powerStatus: 'Not tested', visibleDamage: [],
  otherDamage: '', visibleCondition: '', reportedIssues: '', issueHistory: '',
  previousRepairs: '', liquidExposure: 'Unsure', backupStatus: 'Unsure',
}

export const appointmentIntake = (appointment: CustomerAppointment) =>
  appointment.serviceIntake ?? appointment.homeIntake

export function validateServiceIntake(intake: ServiceIntake | undefined) {
  if (!intake) throw new Error('Complete the device intake before booking.')
  const cleaned = Object.fromEntries(
    Object.entries(intake).map(([key, value]) => [key,
      Array.isArray(value) ? value : typeof value === 'string' ? value.trim() : value]),
  ) as ServiceIntake
  if (!cleaned.customerName || !cleaned.contactPhone || !cleaned.visibleCondition ||
      !cleaned.reportedIssues || !cleaned.issueHistory)
    throw new Error('Complete the customer, condition, and device-history fields.')
  if (!['Desktop PC', 'Laptop'].includes(cleaned.deviceType) ||
      !['Powers on', 'Intermittent', 'Does not power on', 'Not tested'].includes(cleaned.powerStatus) ||
      !['Yes', 'No', 'Unsure'].includes(cleaned.liquidExposure) ||
      !['Backed up', 'Not backed up', 'Not applicable', 'Unsure'].includes(cleaned.backupStatus) ||
      !Array.isArray(cleaned.visibleDamage) ||
      cleaned.visibleDamage.some((damage) => !damageOptions.includes(damage as typeof damageOptions[number])))
    throw new Error('Choose valid device-condition answers.')
  const limits: Partial<Record<keyof ServiceIntake, number>> = {
    customerName: 120, contactPhone: 60, socialHandle: 160, cpu: 160, gpu: 160,
    ram: 160, storage: 160, motherboard: 160, psuOrCharger: 160, cooling: 160,
    serialNumber: 120, accessories: 500, otherDamage: 300, visibleCondition: 1200,
    reportedIssues: 1200, issueHistory: 1200, previousRepairs: 800,
  }
  if (Object.entries(limits).some(([key, limit]) =>
    (cleaned[key as keyof ServiceIntake] as string).length > limit))
    throw new Error('Shorten the device-intake details and try again.')
  return cleaned
}
