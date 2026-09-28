export type View =
  | 'directories'
  | 'dashboard'
  | 'overview'
  | 'jobs'
  | 'sales'
  | 'inventory'
  | 'expenses'
  | 'reports'
  | 'appointments'
  | 'pc-requests'
  | 'pc-directory'
  | 'pc-building'
  | 'pos'
  | 'services'
  | 'pc-identifier'
  | 'settings'
  | 'users'

export type UserRole = 'admin' | 'user'

export type AppUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  adminVerificationRequired: boolean
  role: UserRole
}

export type ServiceIntake = {
  serviceType?: 'general' | 'assembly' | 'diagnosis' | 'upgrade'
  customerName: string
  contactPhone: string
  socialHandle: string
  deviceType: 'Desktop PC' | 'Laptop'
  cpu: string
  gpu: string
  ram: string
  storage: string
  motherboard: string
  psuOrCharger: string
  cooling: string
  desktopCase?: string
  laptopBattery?: string
  laptopDisplay?: string
  assemblyParts?: string
  assemblyGoal?: string
  assemblyOs?: string
  diagnosisSymptoms?: string
  diagnosisTriggers?: string
  diagnosisError?: string
  upgradeCurrent?: string
  upgradeTarget?: string
  upgradePartsSource?: string
  serialNumber: string
  accessories: string
  powerStatus: 'Powers on' | 'Intermittent' | 'Does not power on' | 'Not tested'
  visibleDamage: string[]
  otherDamage: string
  visibleCondition: string
  reportedIssues: string
  issueHistory: string
  previousRepairs: string
  liquidExposure: 'Yes' | 'No' | 'Unsure'
  backupStatus: 'Backed up' | 'Not backed up' | 'Not applicable' | 'Unsure'
}

export type CustomerAppointment = {
  reviewedEstimate?: number
  reviewNote?: string
  scheduleHistory?: {
    at: string
    by: string
    date: string
    time: string
    estimate?: number
    note: string
  }[]
  schemaVersion?: 2
  serviceId?: string
  specifications?: string
  unknownSpecifications?: boolean
  serviceIntake?: ServiceIntake
  /** Older home-service bookings saved before the shared intake was introduced. */
  homeIntake?: Partial<ServiceIntake>
  intakeSignedAt?: string
  intakeSignedBy?: string
  jobId?: string
  slotId?: string
  cancelledBy?: string
  cancelledAt?: string
  cancellationReason?: string
  customerId?: string
  customerName?: string
  customerEmail?: string
  shopId?: string
  id: string
  service: string
  device: string
  preferredDate: string
  visit?: {
    mode: 'Workshop' | 'Home service'
    address: string
    distanceKm: number
    tier?: Tier
    basePrice: number | null
    surcharge: number | null
    transport: number | null
    taxRate: number
    estimate: number | null
  }
  preferredTime: string
  notes: string
  status: ServiceStatus
  createdAt: string
}

export type CustomPcRequest = {
  requestType?: 'Pre-order'
  approvedAt?: string
  approvedBy?: string
  approvalNote?: string
  schemaVersion?: 2
  reservationState?: 'None' | 'Reserved' | 'Consumed' | 'Released'
  transactionId?: string
  cancelledBy?: string
  cancelledAt?: string
  customerId?: string
  customerName?: string
  customerEmail?: string
  shopId?: string
  id: string
  parts?: {
    component: ComponentType
    model: string
    source: 'Stock' | 'Custom' | 'inventory' | 'customer_owned'
    brand?: string
    specs?: string
    price?: number
    inventoryId?: string
    compatibility?: Partial<InventoryItem>
  }[]
  tier?: Tier | 'Unclassified'
  useCase: string
  budget: string
  processor: string
  graphics: string
  memory: string
  storage: string
  notes: string
  status:
    | 'Quote requested'
    | 'Under review'
    | 'Quoted'
    | 'Approved'
    | 'Parts reserved'
    | 'Assembly'
    | 'Ready'
    | 'Completed'
    | 'Cancelled'
    | 'Declined'
  quote?: { amount: number; message: string; createdAt: string }
  createdAt: string
}

export type ServiceStatus =
  | 'Requested'
  | 'Confirmed'
  | 'Checked in'
  | 'In service'
  | 'Ready for checkout'
  | 'Completed'
  | 'Cancelled'
  | 'No show'
export type JobStatus = ServiceStatus | 'Queued' | 'In progress' | 'Ready'

export type Job = {
  schemaVersion?: 2
  customerId?: string
  contact?: string
  appointmentId?: string
  transactionId?: string
  paymentStatus?: 'Unpaid' | 'Paid'
  concern?: string
  intakeNotes?: string
  accessories?: string
  id: string
  customer: string
  device: string
  service: string
  due: string
  quote: number
  status: JobStatus
}

export type SalePayment = {
  id: string
  date: string
  amount: number
  method: string
  cashTendered?: number
  change?: number
  reference?: string
  proofId?: string
  accountId?: string
  verifiedAt?: string
  verifiedBy?: string
}

export type PaymentAccount = {
  id: string
  kind: 'Bank transfer' | 'E-wallet'
  name: string
  accountName: string
  accountNumber: string
  qrImage: string
  enabled: boolean
  customers?: boolean
  pos?: boolean
  instructions?: string
}
export type PaymentProof = {
  id: string
  orderId: string
  customerId: string
  accountId: string
  method: string
  amount: number
  reference: string
  image: string
  submittedAt: string
  status: 'Pending' | 'Verified' | 'Rejected'
  reviewNote?: string
  reviewedAt?: string
  reviewedBy?: string
}
export type TransactionReceipt = {
  id: string
  orderId: string
  customerId: string
  recipientEmail: string
  issuedAt: string
  cashierId: string
  payment: SalePayment
  sale: Sale
}

export type Sale = {
  cancelledAt?: string
  cancelledBy?: string
  schemaVersion?: 2
  reservationState?: 'None' | 'Reserved' | 'Consumed' | 'Released'
  paymentStatus?: 'Unpaid' | 'Pending verification' | 'Paid' | 'Rejected' | 'Refunded'
  buildId?: string
  createdAt?: string
  paidAt?: string
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
  orderStatus?:
    | 'Requested'
    | 'Confirmed'
    | 'Processing'
    | 'Ready'
    | 'Out for delivery'
    | 'Completed'
    | 'Declined'
    | 'Cancelled'
  fulfillment?: {
    mode: 'Pickup' | 'Delivery'
    address: string
    distanceKm: number
    freeDelivery: boolean
    bundleName?: string
    bundleId?: string
    pcSet?: boolean
    baseFee: number
    perKm: number
  }
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
  receiptEmail?: string
  lastReceiptId?: string
}

export type Tier = 'Low' | 'Mid' | 'High'
export type ComponentType =
  | 'Processor'
  | 'Motherboard'
  | 'Memory'
  | 'Graphics'
  | 'Storage'
  | 'Power supply'
  | 'Case'
  | 'Cooling'
export type InvoiceLine = {
  id: string
  description: string
  category?: string
  quantity: number
  unitPrice: number
  unitCost: number
  inventoryId?: string
  warranty?: { months: number | null; terms: string; starts: string; expires: string | null }
}
export type InvoiceCharges = {
  labor: number
  delivery: number
  other: number
  otherLabel: string
  discount: number
  taxRate: number
  tax: number
  subtotal: number
}
export type Seller = { name: string; address: string; phone: string; email: string; footer: string }

export type InventoryItem = {
  skuKey?: string
  reserved?: number
  active?: boolean
  formFactor?: string
  supportedFormFactors?: string
  lengthMm?: number
  gpuClearanceMm?: number
  heightMm?: number
  coolerClearanceMm?: number
  wattage?: number
  powerDraw?: number
  recommendedPsu?: number
  supportedSockets?: string
  storageInterface?: string
  storageInterfaces?: string
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
  vendor?: string
  reference?: string
  notes?: string
  recurrence?: 'One-time' | 'Monthly' | 'Yearly'
  recurringSourceId?: string
  voided?: boolean
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
  audit?: { at: string; by: string; action: string; previous?: Omit<Expense, 'audit'> }[]
  id: string
  description: string
  category: string
  date: string
  amount: number
  method: string
}

export type ProductBundle = {
  id: string
  name: string
  items: { inventoryId: string; quantity: number }[]
  description?: string
  price?: number
  image?: string
  active?: boolean
  published?: boolean
  freeDelivery?: boolean
}

export type ServiceOffering = {
  id: string
  name: string
  deviceType: 'Desktop' | 'Laptop' | 'Any'
  description: string
  inclusions: string
  price: string
  durationMinutes: number
  workshop: boolean
  home: boolean
  active: boolean
}
export type BookingSchedule = {
  days: number[]
  opens: string
  closes: string
  windows: { id: string; start: string; end: string; capacity: number }[]
  blockedDates: string[]
  blockedPeriods: { date: string; start: string; end: string }[]
  dateOverrides?: { date: string; windowId: string; capacity: number }[]
}
export type StockMovement = {
  id: string
  itemId: string
  type: string
  quantityChange: number
  quantityBefore: number
  quantityAfter: number
  reservedBefore: number
  reservedAfter: number
  referenceType: string
  referenceId: string
  reason: string
  timestamp: string
  performedBy: string
}

export type WorkspaceData = {
  jobs: Job[]
  sales: Sale[]
  inventory: InventoryItem[]
  expenses: Expense[]
  bundles: ProductBundle[]
}
export type CheckoutDraft = {
  idempotencyKey?: string
  paymentAccountId?: string
  paymentVerified?: boolean
  paymentReference?: string
  receiptEmail?: string
  cashTendered?: number
  fulfillment?: { mode: 'Pickup' | 'Delivery'; address: string; distanceKm: number }
  bundleId?: string
  pcSet?: boolean
  jobId?: string
  customServices?: { id: string; description: string; unitPrice: number }[]
  customer: string
  contact: string
  channel: 'Walk-in' | 'Online'
  paymentMethod: string
  paid: number
  lines: { id: string; quantity: number }[]
  charges: Omit<InvoiceCharges, 'tax' | 'subtotal'>
  notes: string
}
