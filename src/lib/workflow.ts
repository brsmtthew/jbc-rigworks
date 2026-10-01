import type {
  CustomPcRequest,
  InventoryItem,
  JobStatus,
  PaymentProof,
  Sale,
  ServiceStatus,
} from '../types'

export const availableStock = (item: InventoryItem) =>
  Math.max(0, item.stock - (item.reserved ?? 0))
export const serviceState = (status: JobStatus): ServiceStatus =>
  (
    ({ Queued: 'Checked in', 'In progress': 'In service', Ready: 'Ready for checkout' }) as Partial<
      Record<JobStatus, ServiceStatus>
    >
  )[status] ?? (status as ServiceStatus)
export const serviceTransitions: Record<ServiceStatus, ServiceStatus[]> = {
  Requested: ['Confirmed', 'Cancelled'],
  Confirmed: ['Checked in', 'In service', 'Cancelled', 'No show'],
  'Checked in': ['In service'],
  'In service': ['Completed'],
  'Ready for checkout': ['Completed'],
  Completed: [],
  Cancelled: [],
  'No show': [],
}
export const buildTransitions: Record<CustomPcRequest['status'], CustomPcRequest['status'][]> = {
  'Quote requested': ['Under review', 'Cancelled'],
  'Under review': ['Quoted', 'Cancelled'],
  Quoted: ['Approved', 'Declined'],
  Approved: ['Parts reserved', 'Cancelled'],
  'Parts reserved': ['Assembly', 'Cancelled'],
  Assembly: ['Ready'],
  Ready: ['Completed'],
  Completed: [],
  Cancelled: [],
  Declined: [],
}
export const orderTransitions: Record<
  NonNullable<Sale['orderStatus']>,
  NonNullable<Sale['orderStatus']>[]
> = {
  Requested: ['Confirmed', 'Cancelled'],
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Ready', 'Out for delivery', 'Cancelled'],
  Ready: ['Completed', 'Cancelled'],
  'Out for delivery': ['Completed'],
  Completed: [],
  Cancelled: [],
  Declined: [],
}
export function assertTransition<T extends string>(graph: Record<T, T[]>, from: T, to: T) {
  if (!graph[from]?.includes(to))
    throw new Error(
      `Cannot move from ${from} to ${to}. Refresh this record and use its next action.`,
    )
}
export const isRecognizedSale = (sale: Sale) =>
  sale.status === 'Paid' &&
  sale.paid >= sale.total &&
  !['Cancelled', 'Declined'].includes(sale.orderStatus ?? '')
export function paymentState(sale: Sale, proof?: PaymentProof): NonNullable<Sale['paymentStatus']> {
  if (sale.paymentStatus === 'Refunded') return 'Refunded'
  if (sale.status === 'Paid' && sale.paid >= sale.total) return 'Paid'
  if (proof?.status === 'Pending') return 'Pending verification'
  if (proof?.status === 'Rejected') return 'Rejected'
  return sale.paymentStatus ?? 'Unpaid'
}
export const humanError = (
  error: unknown,
  fallback = 'We could not save your changes. Please try again.',
) => {
  if (error && typeof error === 'object' && 'code' in error) {
    console.error(error)
    return String(error.code).includes('permission')
      ? 'You do not have access to this action. Sign in again or contact JBC RigWorks.'
      : 'We could not connect. Check your connection and try again.'
  }
  return error instanceof Error ? error.message : fallback
}
