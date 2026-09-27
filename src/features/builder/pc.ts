import type { ComponentType, InventoryItem } from '../../types'

export const components: { name: ComponentType; hint: string }[] = [
  { name: 'Processor', hint: 'CPU model and socket' },
  { name: 'Motherboard', hint: 'CPU support and BIOS' },
  { name: 'Memory', hint: 'Memory generation and capacity' },
  { name: 'Graphics', hint: 'Graphics and display needs' },
  { name: 'Storage', hint: 'Drive capacity and interface' },
  { name: 'Power supply', hint: 'Wattage and connectors' },
  { name: 'Case', hint: 'Size and component clearance' },
  { name: 'Cooling', hint: 'Socket mount and case fit' },
]
export function componentOf(item: InventoryItem | undefined) {
  if (!item) return undefined
  return (
    item.component ||
    components.find((part) => part.name.toLowerCase() === item.category.toLowerCase())?.name
  )
}
export function inventoryKind(item: InventoryItem): NonNullable<InventoryItem['kind']> {
  if (item.kind) return item.kind
  return componentOf(item) ? 'part' : 'product'
}
export function isPcPart(item: InventoryItem) {
  return inventoryKind(item) === 'part' && !!componentOf(item)
}
export function isSellable(item: InventoryItem) {
  return (
    item.active !== false && inventoryKind(item) !== 'asset' && inventoryKind(item) !== 'consumable'
  )
}
export function compatibility(items: InventoryItem[]) {
  const find = (type: ComponentType) => items.find((item) => componentOf(item) === type)
  const cpu = find('Processor'),
    board = find('Motherboard'),
    ram = find('Memory')
  const errors: string[] = []
  if (
    cpu?.socket &&
    board?.socket &&
    cpu.socket.trim().toLowerCase() !== board.socket.trim().toLowerCase()
  )
    errors.push('CPU and motherboard sockets do not match.')
  if (
    ram?.memoryType &&
    board?.memoryType &&
    ram.memoryType.trim().toLowerCase() !== board.memoryType.trim().toLowerCase()
  )
    errors.push('Memory and motherboard generations do not match.')
  const chassis = find('Case'),
    gpu = find('Graphics'),
    psu = find('Power supply'),
    cooler = find('Cooling'),
    storage = find('Storage')
  const includes = (list: string, value: string) =>
    list
      .split(/[,;|]/)
      .map((v) => v.trim().toLowerCase())
      .includes(value.trim().toLowerCase())
  if (
    board?.formFactor &&
    chassis?.supportedFormFactors &&
    !includes(chassis.supportedFormFactors, board.formFactor)
  )
    errors.push('Motherboard form factor does not fit the case.')
  if (gpu?.lengthMm && chassis?.gpuClearanceMm && gpu.lengthMm > chassis.gpuClearanceMm)
    errors.push('Graphics card exceeds the case clearance.')
  if (cooler?.heightMm && chassis?.coolerClearanceMm && cooler.heightMm > chassis.coolerClearanceMm)
    errors.push('CPU cooler exceeds the case clearance.')
  if (cpu?.socket && cooler?.supportedSockets && !includes(cooler.supportedSockets, cpu.socket))
    errors.push('Cooler mounting does not support the CPU socket.')
  if (
    storage?.storageInterface &&
    board?.storageInterfaces &&
    !includes(board.storageInterfaces, storage.storageInterface)
  )
    errors.push('Storage interface is not supported by the motherboard.')
  const required = Math.max(estimatedWattage(items) * 1.25, gpu?.recommendedPsu ?? 0)
  if (psu?.wattage && psu.wattage < required)
    errors.push(
      `Power supply is below the estimated requirement (${Math.ceil(required)} W including headroom).`,
    )
  return errors
}
export const estimatedWattage = (items: InventoryItem[]) =>
  items.length
    ? items.reduce(
        (sum, item) =>
          sum +
          (item.powerDraw ??
            {
              Processor: 65,
              Graphics: 150,
              Motherboard: 40,
              Memory: 10,
              Storage: 10,
              Cooling: 10,
              Case: 5,
              'Power supply': 0,
            }[componentOf(item) ?? 'Case']),
        0,
      )
    : 0
export function compatibilitySummary(items: InventoryItem[]) {
  const errors = compatibility(items)
  const has = (type: ComponentType, field: keyof InventoryItem) =>
    !!items.find((item) => componentOf(item) === type)?.[field]
  const checks = [
    ['CPU / motherboard socket', has('Processor', 'socket') && has('Motherboard', 'socket')],
    ['Memory generation', has('Memory', 'memoryType') && has('Motherboard', 'memoryType')],
    [
      'Motherboard / case size',
      has('Motherboard', 'formFactor') && has('Case', 'supportedFormFactors'),
    ],
    ['Graphics card clearance', has('Graphics', 'lengthMm') && has('Case', 'gpuClearanceMm')],
    ['Power capacity', has('Power supply', 'wattage')],
    [
      'Cooler socket and clearance',
      has('Cooling', 'supportedSockets') &&
        has('Processor', 'socket') &&
        has('Cooling', 'heightMm') &&
        has('Case', 'coolerClearanceMm'),
    ],
    [
      'Storage interface',
      has('Storage', 'storageInterface') && has('Motherboard', 'storageInterfaces'),
    ],
  ] as const
  const unknown = checks.filter(([, checked]) => !checked).map(([name]) => name)
  return {
    errors,
    unknown,
    // CPU/GPU ratings are required; other parts use the existing baseline allowances.
    powerEstimateReady:
      (['Processor', 'Motherboard', 'Memory', 'Storage'] as ComponentType[]).every((type) =>
        items.some((item) => componentOf(item) === type),
      ) &&
      items
        .filter((item) => ['Processor', 'Graphics'].includes(componentOf(item) ?? ''))
        .every((item) => Number.isFinite(item.powerDraw) && Number(item.powerDraw) > 0),
    wattage: estimatedWattage(items),
    status: !items.length
      ? 'Not yet checked'
      : errors.length
        ? 'Incompatible'
        : unknown.length
          ? 'Needs attention'
          : 'Compatible',
  }
}
