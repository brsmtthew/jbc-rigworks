import { money } from '../../lib/commerce'
import type { SelectedServiceCharge, ServiceOffering } from '../../types'

export function selectedServiceCharges(offering: ServiceOffering | undefined, ids: string[]) {
  return (offering?.additionalCharges ?? [])
    .filter((charge) => ids.includes(charge.id))
    .map((charge): SelectedServiceCharge => ({
      id: charge.id,
      name: charge.name.trim(),
      price: Number(charge.price),
    }))
}

export function validateRequestedServiceCharges(
  offering: ServiceOffering,
  requested: SelectedServiceCharge[] = [],
): SelectedServiceCharge[] {
  if (!Array.isArray(requested) || requested.length > 20 ||
    new Set(requested.map((charge) => charge.id)).size !== requested.length)
    throw new Error('Review the selected additional charges and try again.')
  const available = new Map((offering.additionalCharges ?? []).map((charge) => [charge.id, charge]))
  return requested.map((charge) => {
    const current = available.get(charge.id)
    if (!current || current.name.trim() !== charge.name ||
      !Number.isFinite(Number(current.price)) || Number(current.price) < 0 ||
      Number(current.price) !== charge.price)
      throw new Error('The service charges changed. Review the options before submitting.')
    return { id: current.id, name: current.name.trim(), price: Number(current.price) }
  })
}

export function serviceChargesTotal(charges: SelectedServiceCharge[] = []) {
  if (!Array.isArray(charges) || charges.some((charge) => !Number.isFinite(charge.price) || charge.price < 0))
    throw new Error('Review the selected additional charges and try again.')
  return money(charges.reduce((sum, charge) => sum + charge.price, 0))
}
