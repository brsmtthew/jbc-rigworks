import { isRecognizedSale } from '../../lib/workflow'
import type { WorkspaceData } from '../../types'

export function getSummary(
  period: string,
  { sales, expenses }: Pick<WorkspaceData, 'sales' | 'expenses'>,
) {
  const periodSales = sales.filter((sale) => isRecognizedSale(sale) && sale.date.startsWith(period))
  const periodExpenses = expenses.filter(
    (expense) => !expense.voided && expense.date.startsWith(period),
  )
  const salesTotal = periodSales.reduce((sum, sale) => sum + sale.total, 0)
  const taxCollected = periodSales.reduce((sum, sale) => sum + (sale.charges?.tax ?? 0), 0)
  const revenue = salesTotal - taxCollected
  const received = periodSales.reduce((sum, sale) => sum + sale.paid, 0)
  const cost = periodSales.reduce((sum, sale) => sum + sale.cost, 0)
  const spent = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  return {
    sales: periodSales,
    expenses: periodExpenses,
    salesTotal,
    taxCollected,
    revenue,
    received,
    cost,
    spent,
    profit: revenue - cost - spent,
  }
}
