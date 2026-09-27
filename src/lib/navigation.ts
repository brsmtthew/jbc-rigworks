import {
  BarChart3,
  BrushCleaning,
  ClipboardList,
  Cpu,
  CreditCard,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Wrench,
} from 'lucide-react'
import type { View } from '../types'

export const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pos', label: 'Point of sale', icon: ShoppingCart },
  { id: 'jobs', label: 'Services', icon: Wrench },
  { id: 'sales', label: 'Sales', icon: CreditCard },
  { id: 'pc-building', label: 'PC Builds', icon: Cpu },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
] satisfies { id: View; label: string; icon: typeof Wrench }[]

export const customerNavigation = [
  { id: 'customer', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customer/services', label: 'Services & booking', icon: BrushCleaning },
  { id: 'customer/pc-building', label: 'PC builder', icon: Cpu },
  { id: 'customer/shop', label: 'Shop', icon: ShoppingCart },
  { id: 'customer/records', label: 'My records', icon: ClipboardList },
] as const
