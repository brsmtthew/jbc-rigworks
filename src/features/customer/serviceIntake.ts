import type { CustomerAppointment, ServiceIntake, ServiceOffering } from '../../types'

export function intakeDeviceTypeForOffering(deviceType?: ServiceOffering['deviceType']) {
  if (deviceType === 'Laptop') return 'Laptop'
  if (deviceType === 'Desktop') return 'Desktop PC'
  return null
}
import { noVisibleDamage } from '../../lib/visibleConditions'

export const emptyServiceIntake: ServiceIntake = {
  serviceType: 'general',
  customerName: '',
  contactPhone: '',
  socialHandle: '',
  deviceType: 'Desktop PC',
  cpu: '',
  gpu: '',
  ram: '',
  storage: '',
  motherboard: '',
  psuOrCharger: '',
  cooling: '',
  serialNumber: '',
  accessories: '',
  powerStatus: 'Not tested',
  visibleDamage: [],
  otherDamage: '',
  visibleCondition: '',
  reportedIssues: '',
  issueHistory: '',
  previousRepairs: '',
  liquidExposure: 'Unsure',
  backupStatus: 'Unsure',
  desktopCase: '',
  laptopBattery: '',
  laptopDisplay: '',
  assemblyParts: '',
  assemblyGoal: '',
  assemblyOs: '',
  diagnosisSymptoms: '',
  diagnosisTriggers: '',
  diagnosisError: '',
  upgradeCurrent: '',
  upgradeTarget: '',
  upgradePartsSource: '',
}

export function intakeTypeForService(
  serviceId?: string,
  serviceName = '',
): NonNullable<ServiceIntake['serviceType']> {
  const name = serviceName.toLowerCase()
  if (serviceId === 'service-2' || name.includes('pc assembly')) return 'assembly'
  if (serviceId === 'service-0' || name.includes('diagnosis') || name.includes('repair'))
    return 'diagnosis'
  if (serviceId === 'service-1' || name.includes('hardware upgrade')) return 'upgrade'
  return 'general'
}

export const appointmentIntake = (appointment: CustomerAppointment) =>
  appointment.serviceIntake ?? appointment.homeIntake

export function validateServiceIntake(intake: ServiceIntake | undefined) {
  if (!intake) throw new Error('Complete the device intake before booking.')
  const cleaned = Object.fromEntries(
    Object.entries(intake).map(([key, value]) => [
      key,
      Array.isArray(value) ? value : typeof value === 'string' ? value.trim() : value,
    ]),
  ) as ServiceIntake
  delete (cleaned as ServiceIntake & { requestedService?: string }).requestedService
  if (
    !cleaned.customerName ||
    !cleaned.contactPhone ||
    !cleaned.visibleCondition ||
    ((cleaned.serviceType ?? 'general') === 'general' &&
      (!cleaned.reportedIssues || !cleaned.issueHistory)) ||
    (cleaned.serviceType === 'diagnosis' && !cleaned.issueHistory)
  )
    throw new Error('Complete the customer, condition, and device-history fields.')
  if (cleaned.serviceType === 'assembly' && (!cleaned.assemblyParts || !cleaned.assemblyGoal))
    throw new Error('Describe the PC assembly parts and intended use.')
  if (cleaned.serviceType === 'diagnosis' && !cleaned.diagnosisSymptoms)
    throw new Error('Describe the symptoms for diagnosis and repair.')
  if (cleaned.serviceType === 'upgrade' && (!cleaned.upgradeCurrent || !cleaned.upgradeTarget))
    throw new Error('Describe the current hardware and desired upgrade.')
  if (
    !['Desktop PC', 'Laptop'].includes(cleaned.deviceType) ||
    !['Powers on', 'Intermittent', 'Does not power on', 'Not tested'].includes(
      cleaned.powerStatus,
    ) ||
    !['Yes', 'No', 'Unsure'].includes(cleaned.liquidExposure) ||
    !['Backed up', 'Not backed up', 'Not applicable', 'Unsure'].includes(cleaned.backupStatus) ||
    !Array.isArray(cleaned.visibleDamage) ||
    cleaned.visibleDamage.some(
      (damage) => typeof damage !== 'string' || !damage.trim() || damage.length > 100,
    )
  )
    throw new Error('Choose valid device-condition answers.')
  if (
    cleaned.visibleDamage.includes(noVisibleDamage) &&
    (cleaned.visibleDamage.length > 1 || !!cleaned.otherDamage)
  )
    throw new Error('No visible damage cannot be combined with damage details.')
  const limits: Partial<Record<keyof ServiceIntake, number>> = {
    customerName: 120,
    contactPhone: 60,
    socialHandle: 160,
    cpu: 160,
    gpu: 160,
    ram: 160,
    storage: 160,
    motherboard: 160,
    psuOrCharger: 160,
    cooling: 160,
    serialNumber: 120,
    accessories: 500,
    otherDamage: 300,
    visibleCondition: 1200,
    reportedIssues: 1200,
    issueHistory: 1200,
    previousRepairs: 800,
    desktopCase: 160,
    laptopBattery: 300,
    laptopDisplay: 300,
    assemblyParts: 1200,
    assemblyGoal: 500,
    assemblyOs: 300,
    diagnosisSymptoms: 1200,
    diagnosisTriggers: 800,
    diagnosisError: 500,
    upgradeCurrent: 800,
    upgradeTarget: 800,
    upgradePartsSource: 300,
  }
  if (
    Object.entries(limits).some(
      ([key, limit]) =>
        ((cleaned[key as keyof ServiceIntake] as string | undefined) ?? '').length > limit,
    )
  )
    throw new Error('Shorten the device-intake details and try again.')
  return cleaned
}
