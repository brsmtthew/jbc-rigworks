import { FolderCog, ScanLine, ShoppingCart, ClipboardList, BrushCleaning, Cpu, BarChart3, CreditCard, LayoutDashboard, Package, ReceiptText, Wrench } from 'lucide-react'
import type { View } from '../types/business'

export const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pos', label: 'Point of sale', icon: ShoppingCart },
  { id: 'pc-identifier', label: 'PC identifier', icon: ScanLine },
  { id: 'jobs', label: 'Service jobs', icon: Wrench },
  { id: 'sales', label: 'Sales & payments', icon: CreditCard },
  { id: 'pc-building', label: 'PC builder', icon: Cpu },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'directories', label: 'Directories', icon: FolderCog },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
] satisfies { id: View; label: string; icon: typeof Wrench }[]

export const customerNavigation = [
  { id: 'customer', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customer/services', label: 'Services & booking', icon: BrushCleaning },
  { id: 'customer/pc-building', label: 'PC builder', icon: Cpu },
  { id: 'customer/shop', label: 'Shop', icon: ShoppingCart },
  { id: 'customer/records', label: 'My records', icon: ClipboardList },
] as const
