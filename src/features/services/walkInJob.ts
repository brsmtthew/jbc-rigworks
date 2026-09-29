import type { Job, ServiceIntake, ServiceOffering } from '../../types'
import { validateServiceIntake } from '../customer/serviceIntake'

export function createWalkInJob({
  id,
  offering,
  intake,
  device,
  due,
  quote,
  confirmedAt,
}: {
  id: string
  offering: ServiceOffering
  intake: ServiceIntake
  device: string
  due: string
  quote: number
  confirmedAt: string
}): Job {
  if (!offering.active || !offering.workshop)
    throw new Error('Choose an available workshop service.')
  if (!device.trim()) throw new Error('Enter the device brand and model.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('Choose a target date.')
  if (!Number.isFinite(quote) || quote < 0)
    throw new Error('Enter a valid approved service price.')
  const cleaned = validateServiceIntake(intake)
  if (
    offering.deviceType !== 'Any' &&
    cleaned.deviceType !== (offering.deviceType === 'Desktop' ? 'Desktop PC' : 'Laptop')
  )
    throw new Error('The device type does not match the selected service.')
  return {
    id,
    schemaVersion: 2,
    channel: 'Walk-in',
    serviceId: offering.id,
    service: `${offering.name} / ${offering.deviceType}`,
    serviceIntake: cleaned,
    confirmedAt,
    customer: cleaned.customerName,
    contact: cleaned.contactPhone,
    device: device.trim(),
    due,
    quote,
    status: 'Checked in',
    paymentStatus: 'Unpaid',
    concern:
      cleaned.reportedIssues ||
      cleaned.diagnosisSymptoms ||
      cleaned.upgradeTarget ||
      cleaned.assemblyGoal,
    intakeNotes: cleaned.visibleCondition,
    accessories: cleaned.accessories,
  }
}
