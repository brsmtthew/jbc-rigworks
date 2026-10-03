import type { ComponentType, InventoryItem } from '../../types'
import type { DirectoryGroup } from '../../lib/directories'

export type CompatibilityField = {
  key: keyof InventoryItem
  label: string
  number?: boolean
  directory?: DirectoryGroup
  multiple?: boolean
}

export const compatibilityFields: Record<ComponentType, CompatibilityField[]> = {
  Processor: [
    { key: 'socket', label: 'CPU socket', directory: 'sockets' },
    { key: 'cores', label: 'CPU cores', number: true },
    { key: 'powerDraw', label: 'Power draw (W)', number: true },
  ],
  Motherboard: [
    { key: 'socket', label: 'CPU socket', directory: 'sockets' },
    { key: 'memoryType', label: 'Memory generation', directory: 'memory' },
    { key: 'formFactor', label: 'Form factor', directory: 'formFactors' },
    { key: 'storageInterfaces', label: 'Storage interfaces (comma separated)', directory: 'storageInterfaces', multiple: true },
  ],
  Memory: [
    { key: 'memoryType', label: 'Memory generation', directory: 'memory' },
    { key: 'memoryGb', label: 'Capacity (GB)', number: true },
  ],
  Graphics: [
    { key: 'vramGb', label: 'Graphics memory (GB)', number: true },
    { key: 'lengthMm', label: 'Length (mm)', number: true },
    { key: 'powerDraw', label: 'Power draw (W)', number: true },
    { key: 'recommendedPsu', label: 'Recommended PSU (W)', number: true },
  ],
  Storage: [{ key: 'storageInterface', label: 'Storage interface', directory: 'storageInterfaces' }],
  'Power supply': [
    { key: 'wattage', label: 'Wattage (W)', number: true },
    { key: 'formFactor', label: 'Form factor', directory: 'powerSupplyFormFactors' },
  ],
  Case: [
    { key: 'supportedFormFactors', label: 'Supported motherboard sizes (comma separated)', directory: 'formFactors', multiple: true },
    { key: 'gpuClearanceMm', label: 'GPU clearance (mm)', number: true },
    { key: 'coolerClearanceMm', label: 'Cooler clearance (mm)', number: true },
  ],
  Cooling: [
    { key: 'supportedSockets', label: 'Supported sockets (comma separated)', directory: 'sockets', multiple: true },
    { key: 'heightMm', label: 'Height (mm)', number: true },
    { key: 'powerDraw', label: 'Power draw (W)', number: true },
  ],
}
