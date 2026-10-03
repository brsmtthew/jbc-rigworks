import { money } from '../../lib/commerce'
import type { Job, SelectedServiceCharge, ServiceIntake, ServiceOffering } from '../../types'
import { validateServiceIntake } from '../customer/serviceIntake'
import { serviceChargesTotal, validateRequestedServiceCharges } from './serviceCharges'

export function createWalkInJob({
  id,
  offering,
  intake,
  device,
  due,
  quote,
  selectedCharges = [],
  concern = '',
  confirmedAt,
}: {
  id: string
  offering: ServiceOffering
  intake: ServiceIntake
  device: string
  due: string
  quote: number
  selectedCharges?: SelectedServiceCharge[]
  concern?: string
  confirmedAt: string
}): Job {
  if (!offering.active || !offering.workshop)
    throw new Error('Choose an available workshop service.')
  if (!device.trim()) throw new Error('Enter the device brand and model.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('Choose a target date.')
  if (!Number.isFinite(quote) || quote < 0)
    throw new Error('Enter a valid approved service price.')
  const charges = validateRequestedServiceCharges(offering, selectedCharges)
  const expectedQuote = offering.price === ''
    ? 0
    : money(Number(offering.price) + serviceChargesTotal(charges))
  if (quote !== expectedQuote)
    throw new Error('The service price or additional charges changed. Review the walk-in service.')
  if (typeof concern !== 'string' || concern.length > 1000)
    throw new Error('Keep the customer concern within 1,000 characters.')
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
    selectedCharges: charges,
    serviceIntake: cleaned,
    confirmedAt,
    customer: cleaned.customerName,
    contact: cleaned.contactPhone,
    device: device.trim(),
    due,
    quote,
    status: 'Checked in',
    paymentStatus: 'Unpaid',
    concern: concern.trim(),
    intakeNotes: cleaned.visibleCondition,
    accessories: cleaned.accessories,
  }
}
