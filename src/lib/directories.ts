import { useStoredValue } from './preferences'
export const directoryLabels = { categories: 'Inventory categories', expenseCategories: 'Expense categories', payments: 'Payment methods', sockets: 'CPU sockets', memory: 'Memory generations', services: 'Booking services', times: 'Appointment times', uses: 'Build purposes' }
export type DirectoryGroup = keyof typeof directoryLabels
export type FeePreset = { id: string; name: string; kind: 'taxRate' | 'labor' | 'other' | 'discount'; value: number }
export const directoryDefaults = {
  categories: ['Processor', 'Motherboard', 'Memory', 'Graphics', 'Storage', 'Power supply', 'Case', 'Cooling', 'Accessories'],
  expenseCategories: ['Utilities', 'Rent', 'Supplies', 'Transport', 'Other'],
  payments: ['Cash', 'GCash', 'Bank transfer', 'Card', 'Pay at workshop'], sockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], memory: ['DDR3', 'DDR4', 'DDR5'],
  services: ['PC deep cleaning', 'Laptop deep cleaning', 'Diagnosis & repair', 'Hardware upgrade', 'PC assembly'],
  times: ['9:00 AM - 11:00 AM', '11:00 AM - 1:00 PM', '2:00 PM - 4:00 PM', '4:00 PM - 6:00 PM'], uses: ['Gaming', 'Work & study', 'Content creation', 'General use'], fees: [] as FeePreset[],
}
export function useDirectories() {
  const [raw, save] = useStoredValue('jbc-rigworks:directories:v1', directoryDefaults)
  const data = { ...raw }
  for (const key of Object.keys(directoryLabels) as DirectoryGroup[]) data[key] = Array.isArray(raw[key]) && raw[key].length && raw[key].every(value => typeof value === 'string' && value.trim()) ? raw[key] : directoryDefaults[key]
  data.fees = Array.isArray(raw.fees) ? raw.fees.filter(fee => fee && typeof fee.id === 'string' && typeof fee.name === 'string' && ['taxRate','labor','other','discount'].includes(fee.kind) && Number.isFinite(fee.value) && fee.value >= 0 && (fee.kind !== 'taxRate' || fee.value <= 100)) : []
  return [data, save] as const
}
