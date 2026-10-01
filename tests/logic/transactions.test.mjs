import { checkout } from '../../src/features/pos/checkoutOperations.ts'
import { saveInventoryItem } from '../../src/features/inventory/inventoryOperations.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seed, read, list } from './memory-db.mjs'
import { defaultShop } from '../../src/lib/shopSettings.ts'
import {
  transitionOrder,
  collectOrderPayment,
  findPayableOrder,
} from '../../src/features/pos/orderOperations.ts'
import { saveBuildPlan, removeBuildPlan } from '../../src/features/builder/buildPlans.ts'
import { advanceBuild } from '../../src/features/builder/buildOperations.ts'
import { submitPaymentProof, rejectPaymentProof } from '../../src/features/finance/payments.ts'
import {
  updateAppointmentStatus,
  receiveAppointmentAsJob,
  recordSignedServiceIntake,
  advanceService,
  reviewAppointment,
} from '../../src/features/services/serviceOperations.ts'
import { nextExpenseDate, recordNextExpense } from '../../src/features/finance/expenseOperations.ts'
import {
  claimSku,
  checkLegacySku,
  skuIdentity,
} from '../../src/features/inventory/inventoryIdentity.ts'
import { runTransaction, recordRef } from './memory-db.mjs'
import { slotLabel } from '../../src/features/services/serviceCatalog.ts'
import { changePendingOrder } from '../../src/features/customer/customerOrderOperations.ts'
import { updatePendingPcRequest } from '../../src/features/customer/customerOperations.ts'

const admin = { id: 'admin', role: 'admin' }

test('customer order details can change before confirmation and cancellation locks the order', async () => {
  const buyer = { id: 'buyer', role: 'user' }
  seed({
    'orders/pending': {
      id: 'pending',
      customerId: 'buyer',
      channel: 'Online',
      orderStatus: 'Requested',
      paid: 0,
      reservationState: 'None',
      customer: 'Buyer',
      contact: '09171234567',
      receiptEmail: 'buyer@example.test',
      notes: '',
      fulfillment: { mode: 'Delivery', address: 'Old address' },
      total: 2000,
    },
  })
  await changePendingOrder(buyer, 'pending', {
    customer: 'Buyer',
    contact: '09998887777',
    receiptEmail: 'buyer@example.test',
    notes: 'Call first',
    address: 'New address',
  })
  assert.equal(read('orders/pending').fulfillment.address, 'New address')
  await assert.rejects(
    changePendingOrder({ id: 'other', role: 'user' }, 'pending', null),
    /already entered/,
  )
  await changePendingOrder(buyer, 'pending', null)
  assert.equal(read('orders/pending').orderStatus, 'Cancelled')
  await assert.rejects(changePendingOrder(buyer, 'pending', null), /already entered/)
})

test('QR lookup prefers the issued invoice and rejects missing or declined orders', async () => {
  seed({
    'orders/scan': { id: 'scan', paid: 0, orderStatus: 'Confirmed' },
    'sales/scan': { id: 'scan', paid: 100, orderStatus: 'Ready' },
    'orders/declined': { id: 'declined', orderStatus: 'Declined' },
    'orders/cancelled': { id: 'cancelled', orderStatus: 'Cancelled' },
    'sales/paid': { id: 'paid', total: 100, paid: 100, status: 'Paid' },
  })
  assert.equal((await findPayableOrder('scan')).paid, 100)
  await assert.rejects(findPayableOrder('missing'), /No order matches/)
  await assert.rejects(findPayableOrder('declined'), /closed/)
  await assert.rejects(findPayableOrder('cancelled'), /closed/)
  await assert.rejects(findPayableOrder('paid'), /already paid/)
})

test('saved build plans preserve selections and ownership while invalid budgets never write', async () => {
  seed({})
  const plan = {
    id: 'plan',
    name: 'Owned build',
    budget: '10000',
    selection: { Memory: '__custom' },
    custom: { Memory: { model: 'Existing RAM', capacity: '16', socket: '', memoryType: 'DDR4' } },
  }
  await saveBuildPlan('buyer', plan)
  assert.deepEqual(read('users/buyer/plans/plan'), plan)
  await assert.rejects(saveBuildPlan('buyer', { ...plan, budget: '-1' }), /valid budget/)
  assert.deepEqual(read('users/buyer/plans/plan'), plan)
  await removeBuildPlan('buyer', 'plan')
  assert.equal(read('users/buyer/plans/plan'), undefined)
})

test('customer can revise selected pre-order parts only before workshop review', async () => {
  const buyer = { id: 'buyer', role: 'user' }
  seed({
    'pcRequests/PC-pending': {
      id: 'PC-pending',
      customerId: 'buyer',
      status: 'Quote requested',
      useCase: 'Gaming',
      budget: '30000',
      processor: 'Old CPU',
      graphics: 'Needs guidance',
      memory: 'Needs guidance',
      storage: 'Needs guidance',
      notes: 'My build',
      parts: [
        { component: 'Processor', model: 'Old CPU', source: 'inventory', inventoryId: 'old' },
      ],
    },
  })
  const changes = {
    useCase: 'Workstation',
    budget: '40000',
    processor: 'New CPU',
    graphics: 'Needs guidance',
    memory: 'Needs guidance',
    storage: 'Needs guidance',
    tier: 'Mid',
    notes: 'My revised build',
    parts: [{ component: 'Processor', model: 'New CPU', source: 'inventory', inventoryId: 'new' }],
  }
  await updatePendingPcRequest(buyer, 'PC-pending', changes)
  assert.equal(read('pcRequests/PC-pending').parts[0].inventoryId, 'new')
  assert.equal(read('pcRequests/PC-pending').status, 'Quote requested')
  await assert.rejects(
    updatePendingPcRequest({ id: 'other', role: 'user' }, 'PC-pending', changes),
    /under workshop review/,
  )
  seed({ 'pcRequests/PC-pending': { ...read('pcRequests/PC-pending'), status: 'Under review' } })
  await assert.rejects(
    updatePendingPcRequest(buyer, 'PC-pending', changes),
    /under workshop review/,
  )
})
const item = {
  id: 'cpu',
  name: 'CPU',
  component: 'Processor',
  category: 'Processor',
  sku: 'CPU',
  stock: 5,
  reserved: 0,
  price: 1000,
  cost: 600,
  minimum: 1,
}
const order = {
  id: 'order',
  customerId: 'buyer',
  customer: 'Buyer',
  contact: '09171234567',
  total: 1000,
  paid: 0,
  cost: 0,
  status: 'Unpaid',
  paymentStatus: 'Unpaid',
  orderStatus: 'Requested',
  reservationState: 'None',
  channel: 'Online',
  fulfillment: { mode: 'Pickup' },
  lines: [{ id: 'cpu', inventoryId: 'cpu', quantity: 1, unitPrice: 1000, unitCost: 0 }],
  charges: { labor: 0, other: 0, discount: 0, taxRate: 0, delivery: 0 },
}
const basic = () =>
  seed({ 'settings/shop': defaultShop, 'inventory/cpu': item, 'orders/order': order })

test('order confirmation reserves; full payment consumes once and creates redacted receipt', async () => {
  basic()
  await transitionOrder(admin, 'order', 'Confirmed')
  assert.equal(read('inventory/cpu').stock, 5)
  assert.equal(read('inventory/cpu').reserved, 1)
  assert.equal(read('sales/order'), undefined)
  assert.equal(read('orders/order').cost, 0)
  assert.equal(read('orderSnapshots/order').cost, 600)
  await assert.rejects(
    collectOrderPayment(admin, 'order', 500, { cashTendered: 500 }),
    /full remaining/,
  )
  await collectOrderPayment(admin, 'order', 1000, { cashTendered: 1200 })
  assert.equal(read('inventory/cpu').stock, 4)
  assert.equal(read('inventory/cpu').reserved, 0)
  assert.equal(read('sales/order').cost, 600)
  assert.equal(read('sales/order').change, 200)
  assert.equal(list('receipts').length, 1)
  assert.equal(list('receipts')[0].sale.cost, 0)
  await assert.rejects(
    collectOrderPayment(admin, 'order', 1000, { cashTendered: 1000 }),
    /already be paid/,
  )
  assert.equal(read('inventory/cpu').stock, 4)
})
test('cancellation releases reservations and retains orders; paid cancellation is rejected', async () => {
  basic()
  await transitionOrder(admin, 'order', 'Confirmed')
  await transitionOrder(admin, 'order', 'Cancelled')
  assert.equal(read('inventory/cpu').stock, 5)
  assert.equal(read('inventory/cpu').reserved, 0)
  assert.equal(read('orders/order').orderStatus, 'Cancelled')
  basic()
  await transitionOrder(admin, 'order', 'Confirmed')
  await collectOrderPayment(admin, 'order', 1000, { cashTendered: 1000 })
  await assert.rejects(transitionOrder(admin, 'order', 'Cancelled'), /refund process/)
})
test('price tampering and insufficient stock leave all records untouched', async () => {
  seed({
    'settings/shop': defaultShop,
    'inventory/cpu': { ...item, reserved: 5 },
    'orders/order': order,
  })
  await assert.rejects(transitionOrder(admin, 'order', 'Confirmed'), /unavailable/)
  assert.equal(list('stockMovements').length, 0)
  seed({
    'settings/shop': defaultShop,
    'inventory/cpu': item,
    'orders/order': { ...order, total: 1 },
  })
  await assert.rejects(transitionOrder(admin, 'order', 'Confirmed'), /prices or charges changed/)
  assert.equal(read('inventory/cpu').reserved, 0)
  await assert.rejects(
    transitionOrder({ id: 'buyer', role: 'user' }, 'order', 'Confirmed'),
    /Only the workshop/,
  )
})
test('pending transfer cannot become cash automatically and verification creates audit metadata', async () => {
  seed({
    'settings/shop': defaultShop,
    'inventory/cpu': item,
    'orders/order': order,
    'paymentProofs/order': {
      id: 'order',
      customerId: 'buyer',
      amount: 1000,
      status: 'Pending',
      method: 'E-wallet',
      accountId: 'wallet',
      reference: 'TX-123',
    },
  })
  await transitionOrder(admin, 'order', 'Confirmed')
  assert.equal(read('orders/order').paymentStatus, 'Pending verification')
  await assert.rejects(
    collectOrderPayment(admin, 'order', 1000, { cashTendered: 1000 }),
    /pending transfer/,
  )
  await collectOrderPayment(admin, 'order', 1000, { verifyProof: true })
  assert.equal(read('paymentProofs/order').status, 'Verified')
  assert.equal(read('sales/order').paymentHistory[0].verifiedBy, 'admin')
  assert.equal(read('sales/order').paymentHistory[0].accountId, 'wallet')
})
test('proof submission and rejection do not recognize revenue or change stock', async () => {
  seed({
    'settings/shop': defaultShop,
    'inventory/cpu': item,
    'orders/order': order,
    'paymentAccounts/wallet': {
      id: 'wallet',
      enabled: true,
      name: 'Wallet',
      accountName: 'Workshop',
      qrImage: 'data:image/png;base64,AA==',
      kind: 'E-wallet',
    },
  })
  const submit = () =>
    submitPaymentProof(
      { id: 'buyer', role: 'user' },
      'order',
      'wallet',
      'TX-123',
      'data:image/png;base64,AA==',
    )
  await submit()
  assert.equal(read('orders/order').paymentStatus, 'Pending verification')
  assert.equal(read('orders/order').paid, 0)
  assert.equal(list('sales').length, 0)
  assert.equal(list('receipts').length, 0)
  assert.equal(read('inventory/cpu').stock, 5)
  await assert.rejects(submit(), /already been submitted/)
  await rejectPaymentProof(admin, 'order', 'Reference not found')
  assert.equal(read('orders/order').paymentStatus, 'Rejected')
  assert.equal(read('paymentProofs/order').reviewedBy, 'admin')
  await submit()
  assert.equal(read('orders/order').paymentStatus, 'Pending verification')
  assert.equal(list('stockMovements').length, 0)
})
test('all-owned builds reserve no inventory, require payment, and synchronize completion', async () => {
  seed({
    'settings/shop': defaultShop,
    'inventory/cpu': item,
    'pcRequests/build': {
      id: 'build',
      customerId: 'buyer',
      customerName: 'Buyer',
      status: 'Approved',
      useCase: 'Gaming',
      quote: { amount: 500 },
      parts: [{ component: 'Processor', source: 'customer_owned', model: 'My CPU' }],
    },
  })
  await advanceBuild(admin, 'build', 'Parts reserved')
  assert.equal(read('inventory/cpu').reserved, 0)
  assert.equal(list('stockMovements').length, 0)
  await advanceBuild(admin, 'build', 'Assembly')
  await advanceBuild(admin, 'build', 'Ready')
  await assert.rejects(advanceBuild(admin, 'build', 'Completed'), /Collect the build payment/)
  await collectOrderPayment(admin, 'BUILD-build', 500, { cashTendered: 500 })
  await advanceBuild(admin, 'build', 'Completed')
  assert.equal(read('pcRequests/build').reservationState, 'Consumed')
  assert.equal(read('orders/BUILD-build').orderStatus, 'Completed')
  assert.equal(read('sales/BUILD-build').orderStatus, 'Completed')
  assert.equal(read('inventory/cpu').stock, 5)
})
test('booking capacity is enforced, check-in is idempotent, and service prices are not taxed twice', async () => {
  const service = {
    id: 'clean',
    name: 'Cleaning',
    deviceType: 'Laptop',
    price: '1000',
    active: true,
    workshop: true,
    home: false,
    durationMinutes: 120,
  }
  const booking = {
    id: 'booking',
    customerId: 'buyer',
    customerName: 'Buyer',
    device: 'Laptop',
    serviceId: 'clean',
    service: 'Cleaning',
    preferredDate: '2099-01-05',
    preferredTime: '09:00–11:00',
    status: 'Requested',
    visit: {
      mode: 'Workshop',
      address: '',
      distanceKm: 0,
      basePrice: 1,
      surcharge: 0,
      transport: 0,
      taxRate: 0,
      estimate: 1,
    },
  }
  seed({
    'settings/shop': { ...defaultShop, taxRate: 12, services: [service] },
    'appointments/booking': booking,
    'appointments/another': { ...booking, id: 'another' },
  })
  await updateAppointmentStatus(admin, 'booking', 'Confirmed')
  assert.equal(read('appointments/booking').visit.estimate, 1120)
  await assert.rejects(
    updateAppointmentStatus(admin, 'another', 'Confirmed'),
    /full or unavailable/,
  )
  await recordSignedServiceIntake(admin, 'booking')
  const job = await receiveAppointmentAsJob(admin, 'booking')
  assert.equal(job.quote, 1000)
  assert.equal((await receiveAppointmentAsJob(admin, 'booking')).id, job.id)
  assert.equal(list('jobs').length, 1)
  await advanceService(admin, job.id, 'In service')
  await assert.rejects(advanceService(admin, job.id, 'Ready for checkout'))
  await assert.rejects(advanceService(admin, job.id, 'Completed'), /Collect payment/)
})
test('paid services complete directly after work and legacy ready jobs remain completable', async () => {
  const job = {
    id: 'paid-service', customer: 'Jamie', device: 'Laptop', service: 'Cleaning',
    due: '2099-01-05', quote: 500, status: 'In service', paymentStatus: 'Paid',
  }
  seed({ 'jobs/paid-service': job, 'jobs/legacy-ready': { ...job, id: 'legacy-ready', status: 'Ready for checkout' } })
  await advanceService(admin, 'paid-service', 'Completed')
  await advanceService(admin, 'legacy-ready', 'Completed')
  assert.equal(read('jobs/paid-service').status, 'Completed')
  assert.equal(read('jobs/legacy-ready').status, 'Completed')
})
test('confirmed rescheduling moves capacity atomically and carries the reviewed estimate', async () => {
  const morning = slotLabel(defaultShop.schedule.windows[0]),
    midday = slotLabel(defaultShop.schedule.windows[1])
  const booking = {
    id: 'booking',
    customerId: 'buyer',
    customerName: 'Buyer',
    device: 'Laptop',
    service: 'Cleaning',
    preferredDate: '2099-01-05',
    preferredTime: morning,
    status: 'Confirmed',
    slotId: '2099-01-05_morning',
  }
  seed({
    'settings/shop': defaultShop,
    'appointments/booking': booking,
    'appointmentSlots/2099-01-05_morning': { count: 1 },
    'appointmentSlots/2099-01-05_midday': { count: 1 },
  })
  const review = { date: '2099-01-05', time: midday, estimate: 850, note: 'Agreed with customer' }
  await assert.rejects(reviewAppointment(admin, 'booking', review), /full or unavailable/)
  assert.equal(read('appointmentSlots/2099-01-05_morning').count, 1)
  await reviewAppointment(admin, 'booking', { ...review, time: morning })
  assert.equal(read('appointmentSlots/2099-01-05_morning').count, 1)
  await reviewAppointment(admin, 'booking', { ...review, date: '2099-01-06' })
  assert.equal(read('appointmentSlots/2099-01-05_morning').count, 0)
  assert.equal(read('appointmentSlots/2099-01-06_midday').count, 1)
  assert.equal(read('appointments/booking').scheduleHistory.length, 2)
  assert.equal((await receiveAppointmentAsJob(admin, 'booking')).quote, 850)
  await assert.rejects(reviewAppointment(admin, 'booking', review), /already progressed/)
})
test('recurring expenses clamp calendar dates, require due payment, and reject duplicates', async () => {
  assert.equal(nextExpenseDate({ date: '2024-01-31', recurrence: 'Monthly' }), '2024-02-29')
  assert.equal(nextExpenseDate({ date: '2024-02-29', recurrence: 'Yearly' }), '2025-02-28')
  const expense = {
    id: 'rent',
    date: '2020-01-31',
    recurrence: 'Monthly',
    amount: 1500,
    description: 'Rent',
    category: 'Rent',
    method: 'Cash',
    reference: 'OLD-RECEIPT',
  }
  seed({ 'expenses/rent': expense })
  const next = await recordNextExpense(admin, 'rent', '2020-02-29')
  assert.equal(next.reference, '')
  assert.equal(next.audit[0].by, 'admin')
  assert.equal(list('expenses').length, 2)
  await assert.rejects(recordNextExpense(admin, 'rent', '2020-02-29'), /already recorded/)
  seed({ 'expenses/rent': { ...expense, date: '2099-01-31' } })
  await assert.rejects(recordNextExpense(admin, 'rent', '2099-02-28'), /on or after/)
  assert.equal(list('expenses').length, 1)
})
test('SKU claims normalize identity, protect legacy items, and release renamed claims', async () => {
  assert.equal(skuIdentity(' cpu/1 '), skuIdentity('CPU/1'))
  seed({ 'inventory/legacy': { ...item, id: 'legacy', sku: ' cpu/1 ' } })
  await assert.rejects(checkLegacySku({ ...item, sku: 'CPU/1' }), /another inventory/)
  seed({})
  const save = (product, previous) =>
    runTransaction({}, async (tx) => {
      const write = await claimSku(tx, product, previous)
      write()
      tx.set(recordRef('inventory', product.id), { ...product, skuKey: skuIdentity(product.sku) })
    })
  await save(item)
  await assert.rejects(save({ ...item, id: 'other', sku: ' cpu ' }), /another inventory/)
  await save({ ...item, sku: 'CPU-NEW' }, read('inventory/cpu'))
  assert.equal(read('inventorySkus/CPU'), undefined)
  assert.equal(read('inventorySkus/CPU-NEW').itemId, 'cpu')
})

test('inventory save and extracted checkout preserve ledger, COGS, and idempotent receipts', async () => {
  seed({ 'settings/shop': defaultShop })
  await saveInventoryItem(admin, { ...item, stock: 1 })
  assert.equal(read('inventorySkus/CPU').itemId, 'cpu')
  assert.equal(read('catalog/cpu').cost, 0)
  assert.equal(read('catalog/cpu').skuKey, undefined)
  const draft = {
    idempotencyKey: 'same-checkout',
    customer: 'Walk-in',
    contact: '',
    channel: 'Walk-in',
    paymentMethod: 'Cash',
    paid: 1000,
    cashTendered: 1200,
    lines: [{ id: 'cpu', quantity: 1 }],
    charges: { labor: 0, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: 0 },
    notes: '',
  }
  const sale = await checkout(admin, draft)
  assert.equal(sale.cost, 600)
  assert.equal(sale.change, 200)
  assert.equal(read('inventory/cpu').stock, 0)
  assert.equal(read('catalog/cpu').stock, 0)
  assert.equal(list('receipts')[0].sale.cost, 0)
  assert.equal(list('receipts')[0].sale.lines[0].unitCost, 0)
  assert.equal(list('stockMovements').length, 2)
  assert.equal((await checkout(admin, draft)).id, sale.id)
  assert.equal(list('sales').length, 1)
  assert.equal(list('receipts').length, 1)
  assert.equal(list('stockMovements').length, 2)
})
