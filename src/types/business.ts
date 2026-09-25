export type View = 'directories' | 'dashboard' | 'overview' | 'jobs' | 'sales' | 'inventory' | 'expenses' | 'reports' | 'appointments' | 'pc-requests' | 'pc-directory' | 'pc-building' | 'pos' | 'services' | 'pc-identifier' | 'settings' | 'users'

export type UserRole = 'admin' | 'user'

export type AppUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role: UserRole
}

export type CustomerAppointment = {
  customerName?: string
  customerEmail?: string
  shopId?: string
  id: string
  service: string
  device: string
  preferredDate: string
  visit?: { mode: 'Workshop' | 'Home service'; address: string; distanceKm: number; tier: Tier; basePrice: number | null; surcharge: number | null; transport: number | null; taxRate: number; estimate: number | null }
  preferredTime: string
  notes: string
  status: 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled'
  createdAt: string
}

export type CustomPcRequest = {
  customerName?: string
  customerEmail?: string
  shopId?: string
  id: string
  parts?: { component: ComponentType; model: string; source: 'Stock' | 'Custom'; brand?: string; specs?: string; price?: number; inventoryId?: string }[]
  tier?: Tier | 'Unclassified'
  useCase: string
  budget: string
  processor: string
  graphics: string
  memory: string
  storage: string
  notes: string
  status: 'Under review' | 'Quoted' | 'Approved' | 'Declined'
  quote?: { amount: number; message: string; createdAt: string }
  createdAt: string
}

export type JobStatus = 'Queued' | 'In progress' | 'Ready' | 'Completed'

export type Job = {
  id: string
  customer: string
  device: string
  service: string
  due: string
  quote: number
  status: JobStatus
}

export type SalePayment = { id: string; date: string; amount: number; method: string; cashTendered?: number; change?: number }

export type Sale = {
  id: string
  customer: string
  detail: string
  date: string
  total: number
  paid: number
  cost: number
  status: 'Paid' | 'Partial' | 'Unpaid'
  cashTendered?: number
  change?: number
  orderStatus?: 'Requested' | 'Processing' | 'Ready' | 'Completed'
  fulfillment?: { mode: 'Pickup' | 'Delivery'; address: string; distanceKm: number; freeDelivery: boolean; bundleName?: string; baseFee: number; perKm: number }
  lines?: InvoiceLine[]
  charges?: InvoiceCharges
  seller?: Seller
  channel?: 'Walk-in' | 'Online'
  customerId?: string
  contact?: string
  paymentMethod?: string
  notes?: string
  serviceJobId?: string
  paymentHistory?: SalePayment[]
}

export type Tier = 'Low' | 'Mid' | 'High'
export type ComponentType = 'Processor' | 'Motherboard' | 'Memory' | 'Graphics' | 'Storage' | 'Power supply' | 'Case' | 'Cooling'
export type InvoiceLine = { id: string; description: string; quantity: number; unitPrice: number; unitCost: number; inventoryId?: string; warranty?: { months: number | null; terms: string; starts: string; expires: string | null } }
export type InvoiceCharges = { labor: number; delivery: number; other: number; otherLabel: string; discount: number; taxRate: number; tax: number; subtotal: number }
export type Seller = { name: string; address: string; phone: string; email: string; footer: string }

export type InventoryItem = {
  id: string
  name: string
  sku: string
  category: string
  stock: number
  minimum: number
  price: number
  cost: number
  image?: string
  specs?: string
  stockHistory?: { date: string; before: number; after: number; reason: string }[]
  component?: ComponentType | ''
  tier?: Tier | ''
  socket?: string
  warrantyMonths?: string
  warrantyTerms?: string
  memoryType?: string
  cores?: number
  memoryGb?: number
  vramGb?: number
  /** Product class used to control what can be sold and built from this record. */
  kind?: 'part' | 'product' | 'asset' | 'consumable'
  brand?: string
  model?: string
  assetTag?: string
  location?: string
}

export type Expense = {
  id: string
  description: string
  category: string
  date: string
  amount: number
  method: string
}

export type ProductBundle = { id: string; name: string; items: { inventoryId: string; quantity: number }[] }
