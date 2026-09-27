import { CircuitBoard, Cpu, Fan, HardDrive, MemoryStick, Monitor, PcCase, Zap } from 'lucide-react'
import type { ComponentType } from '../../types'

export const componentIcons: Record<ComponentType, typeof Cpu> = {
  Processor: Cpu,
  Motherboard: CircuitBoard,
  Memory: MemoryStick,
  Graphics: Monitor,
  Storage: HardDrive,
  'Power supply': Zap,
  Case: PcCase,
  Cooling: Fan,
}
