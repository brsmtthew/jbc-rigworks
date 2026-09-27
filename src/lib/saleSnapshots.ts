import type { Sale } from '../types'

/** Customer-facing orders and receipts must never expose acquisition costs. */
export function customerSale(sale: Sale): Sale {
  return {
    ...sale,
    cost: 0,
    lines: sale.lines?.map((line) => ({ ...line, unitCost: 0 })),
  }
}
