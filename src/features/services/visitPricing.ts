import { money } from '../../lib/commerce'
import { optionalPrice, transportation } from '../../lib/fulfillment'
import type { ShopSettings } from '../../lib/shopSettings'
import type { CustomerAppointment } from '../../types'

export function priceVisit(
  appointment: Pick<CustomerAppointment, 'service' | 'serviceId' | 'visit'>,
  settings: ShopSettings,
) {
  if (!appointment.visit) return undefined
  const visit = { ...appointment.visit }
  if (!['Workshop', 'Home service'].includes(visit.mode))
    throw new Error('Select workshop or home service.')
  if (
    visit.mode === 'Home service' &&
    (typeof visit.address !== 'string' ||
      !visit.address.trim() ||
      !Number.isFinite(visit.distanceKm) ||
      visit.distanceKm < 0)
  )
    throw new Error('Enter your home address and a distance greater than zero.')
  const offering = settings.services.find((service) => service.id === appointment.serviceId)
  if (
    appointment.serviceId &&
    (!offering?.active || (visit.mode === 'Workshop' ? !offering.workshop : !offering.home))
  )
    throw new Error('This service is not available for the selected visit.')
  visit.basePrice = offering ? optionalPrice(offering.price) : appointment.visit.basePrice
  visit.surcharge = visit.mode === 'Workshop' ? 0 : optionalPrice(settings.homeSurcharge)
  visit.transport =
    visit.mode === 'Workshop'
      ? 0
      : visit.distanceKm
        ? transportation(settings, visit.distanceKm)
        : null
  visit.taxRate = settings.taxRate
  visit.estimate =
    visit.basePrice === null || visit.surcharge === null || visit.transport === null
      ? null
      : money((visit.basePrice + visit.surcharge + visit.transport) * (1 + settings.taxRate / 100))
  return visit
}
