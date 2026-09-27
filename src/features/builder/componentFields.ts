import type { ComponentType, InventoryItem } from '../../types'

export const compatibilityFields: Record<
  ComponentType,
  { key: keyof InventoryItem; label: string; number?: boolean }[]
> = {
  Processor: [
    { key: 'socket', label: 'CPU socket' },
    { key: 'cores', label: 'CPU cores', number: true },
    { key: 'powerDraw', label: 'Power draw (W)', number: true },
  ],
  Motherboard: [
    { key: 'socket', label: 'CPU socket' },
    { key: 'memoryType', label: 'Memory generation' },
    { key: 'formFactor', label: 'Form factor' },
    { key: 'storageInterfaces', label: 'Storage interfaces (comma separated)' },
  ],
  Memory: [
    { key: 'memoryType', label: 'Memory generation' },
    { key: 'memoryGb', label: 'Capacity (GB)', number: true },
  ],
  Graphics: [
    { key: 'vramGb', label: 'Graphics memory (GB)', number: true },
    { key: 'lengthMm', label: 'Length (mm)', number: true },
    { key: 'powerDraw', label: 'Power draw (W)', number: true },
    { key: 'recommendedPsu', label: 'Recommended PSU (W)', number: true },
  ],
  Storage: [{ key: 'storageInterface', label: 'Storage interface' }],
  'Power supply': [
    { key: 'wattage', label: 'Wattage (W)', number: true },
    { key: 'formFactor', label: 'Form factor' },
  ],
  Case: [
    { key: 'supportedFormFactors', label: 'Supported motherboard sizes (comma separated)' },
    { key: 'gpuClearanceMm', label: 'GPU clearance (mm)', number: true },
    { key: 'coolerClearanceMm', label: 'Cooler clearance (mm)', number: true },
  ],
  Cooling: [
    { key: 'supportedSockets', label: 'Supported sockets (comma separated)' },
    { key: 'heightMm', label: 'Height (mm)', number: true },
    { key: 'powerDraw', label: 'Power draw (W)', number: true },
  ],
}
