import { after, before, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error(
    'Run these tests with the Firestore emulator. Production databases are never used.',
  )
let env
const customer = (uid) =>
  env
    .authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: uid === 'owner' })
    .firestore()
const put = (db, path, data) => setDoc(doc(db, path), data)
const putInventory = (db, id) => {
  const batch = writeBatch(db)
  batch.set(doc(db, 'inventory', id), {
    id,
    sku: id,
    skuKey: id,
    stock: 3,
    reserved: 0,
    cost: 60,
    price: 100,
  })
  batch.set(doc(db, 'inventorySkus', id), { itemId: id, sku: id })
  return batch.commit()
}
const profile = (role) => ({
  name: 'Test account',
  email: 'owner@example.test',
  role,
  createdAt: serverTimestamp(),
})
const order = (id, uid = 'alice') => ({
  id,
  customerId: uid,
  customer: uid,
  channel: 'Online',
  orderStatus: 'Requested',
  status: 'Unpaid',
  paid: 0,
  cost: 0,
  total: 100,
  lines: [{ inventoryId: 'cpu', quantity: 1, unitPrice: 100, unitCost: 0 }],
  paymentMethod: 'Cash',
  paymentHistory: [],
  receiptEmail: `${uid}@example.test`,
  fulfillment: { mode: 'Pickup' },
})

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-jbc-rigworks',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    await put(context.firestore(), 'users/owner', profile('admin'))
  })
})
after(async () => {
  await env?.cleanup()
})

test('registration can create only a user profile; promotion requires database owner access', async () => {
  const db = customer('alice')
  await assertFails(put(db, 'users/alice', { ...profile('admin'), email: 'alice@example.test' }))
  await assertSucceeds(put(db, 'users/alice', { ...profile('user'), email: 'alice@example.test' }))
  await assertFails(updateDoc(doc(db, 'users/alice'), { role: 'admin' }))
  await assertSucceeds(updateDoc(doc(db, 'users/alice'), { name: 'Alice' }))
  await assertFails(updateDoc(doc(customer('owner'), 'users/alice'), { role: 'admin' }))
})

test('admin writes require a verified account and current database role', async () => {
  const owner = customer('owner')
  await assertSucceeds(putInventory(owner, 'cpu'))
  const unverified = env
    .authenticatedContext('owner', { email: 'owner@example.test', email_verified: false })
    .firestore()
  await assertFails(put(unverified, 'inventory/cpu', { stock: 4 }))
  await env.withSecurityRulesDisabled((context) =>
    updateDoc(doc(context.firestore(), 'users/owner'), { role: 'user' }),
  )
  await assertFails(put(owner, 'inventory/cpu', { stock: 4 }))
})

test('internal business records are private; catalog is readable but not customer editable', async () => {
  const owner = customer('owner'),
    alice = customer('alice')
  for (const path of ['inventory/cpu', 'sales/invoice', 'jobs/job', 'expenses/expense']) {
    if (path.startsWith('inventory/')) await assertSucceeds(putInventory(owner, 'cpu'))
    else
      await assertSucceeds(
        put(owner, path, {
          id: path.split('/')[1],
          ...(path.startsWith('sales/')
            ? { status: 'Paid', paid: 100, total: 100 }
            : path.startsWith('expenses/')
              ? { amount: 100 }
              : {}),
        }),
      )
    await assertFails(getDoc(doc(alice, path)))
    await assertFails(put(alice, path, { changed: true }))
  }
  await assertSucceeds(put(owner, 'catalog/cpu', { name: 'Processor', price: 100 }))
  await assertSucceeds(getDocs(collection(alice, 'catalog')))
  await assertFails(put(alice, 'catalog/cpu', { price: 1 }))
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'catalog')))
})

test('account settings and saved plans are private to their owner', async () => {
  for (const path of ['users/alice/settings/account', 'users/alice/plans/plan']) {
    await assertSucceeds(put(customer('alice'), path, { id: 'plan', name: 'My plan' }))
    await assertSucceeds(getDoc(doc(customer('alice'), path)))
    await assertFails(getDoc(doc(customer('bob'), path)))
    await assertFails(put(customer('bob'), path, { id: 'plan' }))
    await assertFails(getDoc(doc(customer('owner'), path)))
  }
})

test('shop settings are shared; only an admin can change them', async () => {
  for (const path of ['settings/shop', 'settings/directories']) {
    await assertSucceeds(put(customer('owner'), path, { name: 'Workshop' }))
    await assertSucceeds(getDoc(doc(customer('alice'), path)))
    await assertFails(put(customer('alice'), path, { name: 'Changed' }))
  }
})

test('unverified customers create unpaid orders and can query only their own orders', async () => {
  const alice = customer('alice')
  await assertSucceeds(put(alice, 'orders/order1', order('order1')))
  await assertSucceeds(
    getDocs(query(collection(alice, 'orders'), where('customerId', '==', 'alice'))),
  )
  await assertFails(getDocs(collection(alice, 'orders')))
  await assertFails(getDoc(doc(customer('bob'), 'orders/order1')))
  await assertFails(put(alice, 'orders/order2', order('order2', 'bob')))
  await assertFails(updateDoc(doc(alice, 'orders/order1'), { orderStatus: 'Completed' }))
  await assertFails(deleteDoc(doc(alice, 'orders/order1')))
  await assertSucceeds(getDocs(collection(customer('owner'), 'orders')))
})

test('customers can edit or cancel only their own unconfirmed orders', async () => {
  const alice = customer('alice'),
    owner = customer('owner')
  await put(alice, 'orders/editable', order('editable'))
  const ref = doc(alice, 'orders/editable')
  await assertSucceeds(
    updateDoc(ref, { customer: 'Alice', contact: '09171234567', notes: 'Call first' }),
  )
  await assertFails(updateDoc(ref, { total: 1 }))
  await assertFails(updateDoc(ref, { fulfillment: { mode: 'Delivery', address: 'Manila' } }))
  await assertFails(updateDoc(doc(customer('bob'), 'orders/editable'), { notes: 'Other customer' }))
  await assertSucceeds(
    updateDoc(ref, {
      orderStatus: 'Cancelled',
      cancelledBy: 'alice',
      cancelledAt: '2026-09-28T00:00:00Z',
    }),
  )
  await assertFails(updateDoc(ref, { notes: 'Too late' }))
  await put(alice, 'orders/confirmed', order('confirmed'))
  await updateDoc(doc(owner, 'orders/confirmed'), { orderStatus: 'Confirmed' })
  await assertFails(updateDoc(doc(alice, 'orders/confirmed'), { notes: 'Too late' }))
})

test('customers cannot submit paid orders, payment histories or service-job invoices', async () => {
  for (const changes of [
    { paid: 100 },
    { status: 'Paid' },
    { cost: 50 },
    { orderStatus: 'Processing' },
    { paymentHistory: [{ amount: 100 }] },
    { serviceJobId: 'job' },
    { lines: [] },
    { paymentMethod: 'Card' },
    { fulfillment: { mode: 'Delivery' } },
    { receiptEmail: '' },
    { lastReceiptId: 'fake' },
  ]) {
    await assertFails(put(customer('alice'), 'orders/order1', { ...order('order1'), ...changes }))
  }
  await assertFails(put(env.unauthenticatedContext().firestore(), 'orders/order1', order('order1')))
})

test('unverified customers submit proofs; payment verification remains staff-only', async () => {
  const alice = customer('alice'),
    owner = customer('owner'),
    bob = customer('bob')
  const path = 'paymentProofs/order1'
  const proof = {
    id: 'order1',
    orderId: 'order1',
    customerId: 'alice',
    accountId: 'bank',
    method: 'Bank transfer',
    amount: 100,
    reference: 'TRANSFER-1',
    image: 'data:image/png;base64,AAAA',
    submittedAt: '2026-09-26T01:00:00Z',
    status: 'Pending',
  }
  await put(alice, 'orders/order1', order('order1'))
  await assertSucceeds(getDoc(doc(alice, path))) // Transaction can read a not-yet-created proof.
  await assertFails(put(alice, path, proof))
  await assertFails(put(alice, 'paymentAccounts/bank', { enabled: true }))
  await put(owner, 'paymentAccounts/bank', {
    id: 'bank',
    kind: 'Bank transfer',
    name: 'Test bank',
    accountName: 'Test company',
    enabled: false,
    qrImage: 'data:image/png;base64,AAAA',
  })
  await assertFails(put(alice, path, proof))
  await updateDoc(doc(owner, 'paymentAccounts/bank'), { enabled: true })
  await assertFails(put(bob, path, { ...proof, customerId: 'bob' }))
  for (const changes of [
    { status: 'Verified' },
    { amount: 99 },
    { reviewedBy: 'owner' },
    { method: 'Cash' },
    { image: 'https://invalid.test/proof' },
  ])
    await assertFails(put(alice, path, { ...proof, ...changes }))
  await assertSucceeds(put(alice, path, proof))
  await assertSucceeds(
    getDocs(query(collection(alice, 'paymentProofs'), where('customerId', '==', 'alice'))),
  )
  await assertFails(getDoc(doc(bob, path)))
  await assertFails(getDocs(collection(alice, 'paymentProofs')))
  await assertFails(put(alice, path, { ...proof, reference: 'REPLACED' }))
  await assertFails(updateDoc(doc(alice, path), { status: 'Verified' }))
  await assertSucceeds(
    updateDoc(doc(owner, path), { status: 'Rejected', reviewNote: 'Wrong reference' }),
  )
  await assertSucceeds(put(alice, path, { ...proof, reference: 'CORRECTED' }))
  await assertSucceeds(updateDoc(doc(owner, path), { status: 'Verified' }))
  await assertFails(put(alice, path, proof))
})

test('receipts are immutable and private; only staff can prepare receipt emails', async () => {
  const owner = customer('owner'),
    alice = customer('alice'),
    bob = customer('bob')
  const receipt = { id: 'receipt1', customerId: 'alice', orderId: 'order1' }
  await assertFails(put(alice, 'receipts/receipt1', receipt))
  await assertSucceeds(put(owner, 'receipts/receipt1', receipt))
  await assertSucceeds(getDoc(doc(alice, 'receipts/receipt1')))
  await assertFails(getDoc(doc(bob, 'receipts/receipt1')))
  await assertFails(updateDoc(doc(owner, 'receipts/receipt1'), { orderId: 'changed' }))
  await assertFails(deleteDoc(doc(owner, 'receipts/receipt1')))
  const email = { receiptId: 'receipt1', to: 'alice@example.test', status: 'Queued' }
  await assertFails(put(alice, 'receiptEmails/receipt1', email))
  await assertSucceeds(put(owner, 'receiptEmails/receipt1', email))
  await assertFails(getDoc(doc(alice, 'receiptEmails/receipt1')))
  await assertFails(updateDoc(doc(owner, 'receiptEmails/receipt1'), { status: 'Sent' }))
})

test('customers can edit pending booking details but cannot confirm or reassign a booking', async () => {
  const alice = customer('alice'),
    ref = doc(alice, 'appointments/booking')
  await assertSucceeds(
    setDoc(ref, {
      id: 'booking',
      customerId: 'alice',
      customerEmail: 'alice@example.test',
      status: 'Requested',
      device: 'Test PC',
      preferredDate: '2026-10-01',
      notes: '',
    }),
  )
  await assertSucceeds(updateDoc(ref, { notes: 'New notes', preferredDate: '2026-10-01' }))
  await assertFails(updateDoc(ref, { status: 'Confirmed' }))
  await assertFails(updateDoc(ref, { customerId: 'bob' }))
  await assertFails(getDoc(doc(customer('bob'), 'appointments/booking')))
  await assertSucceeds(
    updateDoc(doc(customer('owner'), 'appointments/booking'), { status: 'Confirmed' }),
  )
  await assertFails(updateDoc(ref, { notes: 'Too late' }))
  await assertFails(deleteDoc(ref))
})

test('home and workshop bookings require intake details and customers cannot mark paper signatures collected', async () => {
  const alice = customer('alice')
  const base = {
    id: 'home-booking',
    customerId: 'alice',
    customerEmail: 'alice@example.test',
    status: 'Requested',
    device: 'Test PC',
    preferredDate: '2026-10-01',
    preferredTime: '09:00–11:00',
    visit: { mode: 'Home service', address: 'Manila' },
  }
  const intake = {
    customerName: 'Alice',
    contactPhone: '09171234567',
    deviceType: 'Desktop PC',
    visibleDamage: ['Scratches'],
    visibleCondition: 'Small scratch',
    reportedIssues: 'Fan noise',
    issueHistory: 'Started last month',
    powerStatus: 'Powers on',
    liquidExposure: 'No',
    backupStatus: 'Backed up',
  }
  const ref = doc(alice, 'appointments/home-booking')
  const claim = (appointment, windowId) => {
    const batch = writeBatch(alice)
    const slotId = `2026-10-01_${windowId}`
    batch.set(doc(alice, `appointments/${appointment.id}`), { ...appointment, slotId })
    batch.set(doc(alice, `appointmentSlots/${slotId}`), {
      id: slotId,
      date: '2026-10-01',
      windowId,
      count: 1,
      holds: { [appointment.id]: 'alice' },
      lastAppointmentId: appointment.id,
    })
    return batch.commit()
  }
  await assertFails(setDoc(ref, base))
  await assertFails(setDoc(ref, { ...base, serviceIntake: intake, intakeSignedAt: '2026-10-01' }))
  await assertFails(claim(base, 'morning'))
  await assertSucceeds(claim({ ...base, serviceIntake: intake }, 'morning'))
  await assertFails(updateDoc(ref, { intakeSignedAt: '2026-10-01' }))
  await assertSucceeds(
    updateDoc(doc(customer('owner'), 'appointments/home-booking'), {
      reviewNote: 'Reviewed by staff',
    }),
  )
  await assertFails(updateDoc(ref, { notes: 'Too late after review' }))
  const workshop = { ...base, id: 'workshop-booking', visit: { mode: 'Workshop', address: '' } }
  const workshopRef = doc(alice, 'appointments/workshop-booking')
  await assertFails(setDoc(workshopRef, workshop))
  await assertSucceeds(
    claim({ ...workshop, serviceIntake: intake, preferredTime: '11:00–13:00' }, 'midday'),
  )
})

test('booking holds are paired with one pending appointment and released on cancellation', async () => {
  const alice = customer('alice')
  const appointmentId = 'hold-check'
  const slotId = '2026-10-01_morning'
  const appointment = {
    id: appointmentId,
    customerId: 'alice',
    customerEmail: 'alice@example.test',
    status: 'Requested',
    device: 'Desktop',
    preferredDate: '2026-10-01',
    preferredTime: '09:00–11:00',
    slotId,
    visit: { mode: 'Workshop', address: '' },
    serviceIntake: {
      customerName: 'Alice',
      contactPhone: '09171234567',
      deviceType: 'Desktop PC',
      visibleDamage: [],
      visibleCondition: 'No visible damage',
      reportedIssues: 'Fan noise',
      issueHistory: 'Started last week',
      powerStatus: 'Powers on',
      liquidExposure: 'No',
      backupStatus: 'Backed up',
    },
  }
  const slot = {
    id: slotId,
    date: '2026-10-01',
    windowId: 'morning',
    count: 1,
    holds: { [appointmentId]: 'alice' },
    lastAppointmentId: appointmentId,
  }
  await assertFails(put(alice, `appointmentSlots/${slotId}`, slot))
  const batch = writeBatch(alice)
  batch.set(doc(alice, `appointments/${appointmentId}`), appointment)
  batch.set(doc(alice, `appointmentSlots/${slotId}`), slot)
  await assertSucceeds(batch.commit())
  await assertFails(updateDoc(doc(alice, `appointmentSlots/${slotId}`), { count: 2 }))
  const release = writeBatch(alice)
  release.update(doc(alice, `appointments/${appointmentId}`), {
    status: 'Cancelled',
    cancelledBy: 'alice',
    cancelledAt: '2026-09-28T00:00:00Z',
  })
  release.update(doc(alice, `appointmentSlots/${slotId}`), {
    count: 0,
    holds: {},
    lastAppointmentId: appointmentId,
  })
  await assertSucceeds(release.commit())
  await assertFails(updateDoc(doc(alice, `appointments/${appointmentId}`), { notes: 'Too late' }))
})

test('customers respond to workshop quotes without altering their prices', async () => {
  const alice = customer('alice'),
    ref = doc(alice, 'pcRequests/build')
  const request = {
    id: 'build',
    customerId: 'alice',
    customerEmail: 'alice@example.test',
    status: 'Quote requested',
    notes: '',
  }
  await assertFails(setDoc(ref, { ...request, quote: { amount: 1 } }))
  await assertSucceeds(setDoc(ref, request))
  await assertSucceeds(updateDoc(ref, { notes: 'Build notes' }))
  await assertSucceeds(
    updateDoc(ref, {
      parts: [
        { component: 'Processor', model: 'Ryzen 7', source: 'inventory', inventoryId: 'cpu-1' },
      ],
      tier: 'Mid',
      processor: 'Ryzen 7',
      budget: '40000',
    }),
  )
  await assertFails(updateDoc(ref, { status: 'Approved' }))
  await assertSucceeds(
    updateDoc(doc(customer('owner'), 'pcRequests/build'), { status: 'Under review' }),
  )
  await assertFails(updateDoc(ref, { notes: 'Too late' }))
  await assertFails(updateDoc(ref, { parts: [] }))
  await assertSucceeds(
    updateDoc(doc(customer('owner'), 'pcRequests/build'), {
      status: 'Quoted',
      quote: { amount: 1000 },
    }),
  )
  await assertFails(updateDoc(ref, { status: 'Approved', quote: { amount: 1 } }))
  await assertSucceeds(updateDoc(ref, { status: 'Approved' }))
  await assertFails(updateDoc(ref, { status: 'Under review' }))
  await assertFails(getDoc(doc(customer('bob'), 'pcRequests/build')))
})
