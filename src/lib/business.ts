import type { WorkspaceData } from './workspaceStorage'

export const formatDate = (date: string) => new Intl.DateTimeFormat('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric',
}).format(new Date(`${date}T12:00:00`))

export function getSummary(period: string, { sales, expenses }: Pick<WorkspaceData, 'sales' | 'expenses'>) {
  const periodSales = sales.filter(sale => sale.date.startsWith(period))
  const periodExpenses = expenses.filter(expense => expense.date.startsWith(period))
  const salesTotal = periodSales.reduce((sum, sale) => sum + sale.total, 0)
  const taxCollected = periodSales.reduce((sum, sale) => sum + (sale.charges?.tax ?? 0), 0)
  const revenue = salesTotal - taxCollected
  const received = periodSales.reduce((sum, sale) => sum + sale.paid, 0)
  const cost = periodSales.reduce((sum, sale) => sum + sale.cost, 0)
  const spent = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  return { sales: periodSales, expenses: periodExpenses, salesTotal, taxCollected, revenue, received, cost, spent,
    outstanding: salesTotal - received, profit: revenue - cost - spent,
    unpaid: periodSales.filter(sale => sale.paid < sale.total).length }
}

export type ExcelData = { name: string; rows: (string | number)[][] }
export function prepareExcel(name: string, rows: (string | number)[][]): ExcelData { return { name, rows } }

export async function downloadExcel(name: string, rows: (string | number)[][]) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  workbook.creator = 'JBC RigWorks'
  const sheet = workbook.addWorksheet('Records', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.addRows(rows)
  sheet.columns.forEach((column, index) => { column.width = rows.reduce((width, row) => Math.min(48, Math.max(width, String(row[index] ?? '').length + 3)), 16) })
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF022753' } }
  sheet.getRow(1).height = 26
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length), column: rows[0]?.length || 1 } }
  sheet.eachRow((row, index) => {
    row.alignment = { vertical: 'middle', wrapText: true }
    if (index > 1) row.eachCell((cell, col) => {
      if (typeof cell.value === 'number' && /PHP/.test(String(rows[0]?.[col - 1]))) cell.numFmt = '#,##0.00'
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0DCE8' } } }
    })
  })
  const data = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url; link.download = name.replace(/[^a-z0-9_-]/gi, '-') + '.xlsx'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
