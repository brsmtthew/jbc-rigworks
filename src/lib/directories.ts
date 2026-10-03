import { useStoredValue } from './preferences'
import { defaultVisibleConditions, noVisibleDamage } from './visibleConditions'

export const directoryLabels = {
  categories: 'Inventory categories',
  expenseCategories: 'Expense categories',
  payments: 'Expense payment methods',
  sockets: 'CPU sockets',
  memory: 'Memory generations',
  formFactors: 'Motherboard form factors',
  powerSupplyFormFactors: 'Power supply form factors',
  storageInterfaces: 'Storage interfaces',
  services: 'Booking services',
  times: 'Appointment times',
  visibleConditions: 'Visible conditions',
  uses: 'Build purposes',
}
export type DirectoryGroup = keyof typeof directoryLabels
export type FeePreset = {
  id: string
  name: string
  kind: 'taxRate' | 'labor' | 'other' | 'discount'
  value: number
}
export const directoryDefaults = {
  categories: [
    'Processor',
    'Motherboard',
    'Memory',
    'Graphics',
    'Storage',
    'Power supply',
    'Case',
    'Cooling',
    'Accessories',
  ],
  expenseCategories: ['Utilities', 'Rent', 'Supplies', 'Transport', 'Other'],
  payments: ['Cash', 'GCash', 'Bank transfer', 'Card'],
  sockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'],
  memory: ['DDR3', 'DDR4', 'DDR5'],
  formFactors: ['ATX', 'Micro-ATX', 'Mini-ITX', 'E-ATX'],
  powerSupplyFormFactors: ['ATX', 'SFX', 'SFX-L', 'TFX'],
  storageInterfaces: ['SATA', 'NVMe', 'M.2 SATA', 'PCIe'],
  services: [
    'PC deep cleaning',
    'Laptop deep cleaning',
    'Diagnosis & repair',
    'Hardware upgrade',
    'PC assembly',
  ],
  times: ['9:00 AM - 11:00 AM', '11:00 AM - 1:00 PM', '2:00 PM - 4:00 PM', '4:00 PM - 6:00 PM'],
  visibleConditions: defaultVisibleConditions,
  uses: ['Gaming', 'Work & study', 'Content creation', 'General use'],
  fees: [] as FeePreset[],
  inactive: {} as Partial<Record<DirectoryGroup, string[]>>,
}
export function useDirectories(includeInactive = false) {
  const [raw, save, status] = useStoredValue('jbc-rigworks:directories:v1', directoryDefaults)
  const data = { ...raw }
  for (const key of Object.keys(directoryLabels) as DirectoryGroup[])
    data[key] =
      Array.isArray(raw[key]) &&
      raw[key].length &&
      raw[key].every((value) => typeof value === 'string' && value.trim())
        ? raw[key]
        : directoryDefaults[key]
  // Older saved directories included this exclusive answer among the damage issues.
  data.visibleConditions = data.visibleConditions.filter((value) => value !== noVisibleDamage)
  if (!data.visibleConditions.length) data.visibleConditions = directoryDefaults.visibleConditions
  data.fees = Array.isArray(raw.fees)
    ? raw.fees.filter(
        (fee) =>
          fee &&
          typeof fee.id === 'string' &&
          typeof fee.name === 'string' &&
          ['taxRate', 'labor', 'other', 'discount'].includes(fee.kind) &&
          Number.isFinite(fee.value) &&
          fee.value >= 0 &&
          (fee.kind !== 'taxRate' || fee.value <= 100),
      )
    : []
  data.inactive = raw.inactive ?? {}
  if (!includeInactive)
    for (const key of Object.keys(directoryLabels) as DirectoryGroup[])
      data[key] = data[key].filter((value) => !data.inactive[key]?.includes(value))
  return [data, save, status] as const
}
