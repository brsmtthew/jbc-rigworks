import { CircuitBoard, Cpu, Fan, HardDrive, MemoryStick, Monitor, PcCase, Zap } from 'lucide-react'
import type { ComponentType, InventoryItem, Tier } from '../types/business'
export const components: { name: ComponentType; icon: typeof Cpu; hint: string }[] = [
  { name: 'Processor', icon: Cpu, hint: 'CPU model and socket' }, { name: 'Motherboard', icon: CircuitBoard, hint: 'CPU support and BIOS' },
  { name: 'Memory', icon: MemoryStick, hint: 'Memory generation and capacity' }, { name: 'Graphics', icon: Monitor, hint: 'Graphics and display needs' },
  { name: 'Storage', icon: HardDrive, hint: 'Drive capacity and interface' }, { name: 'Power supply', icon: Zap, hint: 'Wattage and connectors' },
  { name: 'Case', icon: PcCase, hint: 'Size and component clearance' }, { name: 'Cooling', icon: Fan, hint: 'Socket mount and case fit' },
]
export const tiers: Tier[] = ['Low', 'Mid', 'High']
export function componentOf(item: InventoryItem | undefined) { if (!item) return undefined; return item.component || components.find(part => part.name.toLowerCase() === item.category.toLowerCase())?.name }
export function buildTier(items: InventoryItem[]): Tier | 'Unclassified' {
  const cpu = items.find(item => componentOf(item) === 'Processor')
  const gpu = items.find(item => componentOf(item) === 'Graphics')
  if (!cpu?.tier || !gpu?.tier) return 'Unclassified'
  const ram = items.find(item => componentOf(item) === 'Memory')
  const ratings = [cpu.tier, gpu.tier, ...(ram?.tier ? [ram.tier] : [])]
  return tiers[Math.min(...ratings.map(tier => tiers.indexOf(tier))) ]
}
export function compatibility(items: InventoryItem[]) {
  const find = (type: ComponentType) => items.find(item => componentOf(item) === type)
  const cpu = find('Processor'), board = find('Motherboard'), ram = find('Memory')
  const errors: string[] = []
  if (cpu?.socket && board?.socket && cpu.socket.trim().toLowerCase() !== board.socket.trim().toLowerCase()) errors.push('CPU and motherboard sockets do not match.')
  if (ram?.memoryType && board?.memoryType && ram.memoryType.trim().toLowerCase() !== board.memoryType.trim().toLowerCase()) errors.push('Memory and motherboard generations do not match.')
  return errors
}
