import type { InvoiceCharges, InvoiceLine } from '../types'

export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export function invoiceTotals(
  lines: InvoiceLine[],
  charges: Omit<InvoiceCharges, 'tax' | 'subtotal'>,
) {
  const subtotal = money(
    lines.reduce((sum, line) => sum + money(line.unitPrice * line.quantity), 0),
  )
  const taxable = money(
    subtotal + charges.labor + charges.delivery + charges.other - charges.discount,
  )
  const tax = money((taxable * charges.taxRate) / 100)
  return { subtotal, tax, total: money(taxable + tax) }
}
