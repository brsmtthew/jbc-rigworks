import { after, before, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run these tests with the Firestore emulator. Production databases are never used.')
let env
const customer = uid => env.authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: uid === 'owner' }).firestore()
const put = (db, path, data) => setDoc(doc(db, path), data)
const profile = role => ({ name: 'Test account', email: 'owner@example.test', role, createdAt: serverTimestamp() })
const order = (id, uid = 'alice') => ({
  id, customerId: uid, customer: uid, channel: 'Online', orderStatus: 'Requested', status: 'Unpaid',
  paid: 0, cost: 0, total: 100, lines: [{ inventoryId: 'cpu', quantity: 1, unitPrice: 100, unitCost: 0 }],
  paymentMethod: 'Cash', paymentHistory: [], receiptEmail: `${uid}@example.test`, fulfillment: { mode: 'Pickup' },
})

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-jbc-rigworks',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    await put(context.firestore(), 'users/owner', profile('admin'))
  })
})
after(async () => { await env?.cleanup() })

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
  await assertSucceeds(put(owner, 'inventory/cpu', { id: 'cpu', stock: 3 }))
  const unverified = env.authenticatedContext('owner', { email: 'owner@example.test', email_verified: false }).firestore()
  await assertFails(put(unverified, 'inventory/cpu', { stock: 4 }))
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'users/owner'), { role: 'user' }))
  await assertFails(put(owner, 'inventory/cpu', { stock: 4 }))
})

test('internal business records are private; catalog is readable but not customer editable', async () => {
  const owner = customer('owner'), alice = customer('alice')
  for (const path of ['inventory/cpu', 'sales/invoice', 'jobs/job', 'expenses/expense']) {
    await assertSucceeds(put(owner, path, { id: path.split('/')[1] }))
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
  await assertSucceeds(getDocs(query(collection(alice, 'orders'), where('customerId', '==', 'alice'))))
  await assertFails(getDocs(collection(alice, 'orders')))
  await assertFails(getDoc(doc(customer('bob'), 'orders/order1')))
  await assertFails(put(alice, 'orders/order2', order('order2', 'bob')))
  await assertFails(updateDoc(doc(alice, 'orders/order1'), { orderStatus: 'Completed' }))
  await assertFails(deleteDoc(doc(alice, 'orders/order1')))
  await assertSucceeds(getDocs(collection(customer('owner'), 'orders')))
})

test('customers cannot submit paid orders, payment histories or service-job invoices', async () => {
  for (const changes of [{ paid: 100 }, { status: 'Paid' }, { cost: 50 }, { orderStatus: 'Processing' }, { paymentHistory: [{ amount: 100 }] }, { serviceJobId: 'job' }, { lines: [] }, { paymentMethod: 'Card' }, { fulfillment: { mode: 'Delivery' } }, { receiptEmail: '' }, { lastReceiptId: 'fake' }]) {
    await assertFails(put(customer('alice'), 'orders/order1', { ...order('order1'), ...changes }))
  }
  await assertFails(put(env.unauthenticatedContext().firestore(), 'orders/order1', order('order1')))
})

test('unverified customers submit proofs; payment verification remains staff-only', async () => {
  const alice = customer('alice'), owner = customer('owner'), bob = customer('bob')
  const path = 'paymentProofs/order1'
  const proof = { id: 'order1', orderId: 'order1', customerId: 'alice', accountId: 'bank', method: 'Bank transfer', amount: 100, reference: 'TRANSFER-1', image: 'data:image/png;base64,AAAA', submittedAt: '2026-09-26T01:00:00Z', status: 'Pending' }
  await put(alice, 'orders/order1', order('order1'))
  await assertSucceeds(getDoc(doc(alice, path))) // Transaction can read a not-yet-created proof.
  await assertFails(put(alice, path, proof))
  await assertFails(put(alice, 'paymentAccounts/bank', { enabled: true }))
  await put(owner, 'paymentAccounts/bank', { id: 'bank', kind: 'Bank transfer', name: 'Test bank', accountName: 'Test company', enabled: false, qrImage: 'data:image/png;base64,AAAA' })
  await assertFails(put(alice, path, proof))
  await updateDoc(doc(owner, 'paymentAccounts/bank'), { enabled: true })
  await assertFails(put(bob, path, { ...proof, customerId: 'bob' }))
  for (const changes of [{ status: 'Verified' }, { amount: 99 }, { reviewedBy: 'owner' }, { method: 'Cash' }, { image: 'https://invalid.test/proof' }]) await assertFails(put(alice, path, { ...proof, ...changes }))
  await assertSucceeds(put(alice, path, proof))
  await assertSucceeds(getDocs(query(collection(alice, 'paymentProofs'), where('customerId', '==', 'alice'))))
  await assertFails(getDoc(doc(bob, path)))
  await assertFails(getDocs(collection(alice, 'paymentProofs')))
  await assertFails(put(alice, path, { ...proof, reference: 'REPLACED' }))
  await assertFails(updateDoc(doc(alice, path), { status: 'Verified' }))
  await assertSucceeds(updateDoc(doc(owner, path), { status: 'Rejected', reviewNote: 'Wrong reference' }))
  await assertSucceeds(put(alice, path, { ...proof, reference: 'CORRECTED' }))
  await assertSucceeds(updateDoc(doc(owner, path), { status: 'Verified' }))
  await assertFails(put(alice, path, proof))
})

test('receipts are immutable and private; only staff can prepare receipt emails', async () => {
  const owner = customer('owner'), alice = customer('alice'), bob = customer('bob')
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
  const alice = customer('alice'), ref = doc(alice, 'appointments/booking')
  await assertSucceeds(setDoc(ref, { id: 'booking', customerId: 'alice', customerEmail: 'alice@example.test', status: 'Requested', notes: '' }))
  await assertSucceeds(updateDoc(ref, { notes: 'New notes', preferredDate: '2026-10-01' }))
  await assertFails(updateDoc(ref, { status: 'Confirmed' }))
  await assertFails(updateDoc(ref, { customerId: 'bob' }))
  await assertFails(getDoc(doc(customer('bob'), 'appointments/booking')))
  await assertSucceeds(updateDoc(doc(customer('owner'), 'appointments/booking'), { status: 'Confirmed' }))
  await assertFails(updateDoc(ref, { notes: 'Too late' }))
  await assertFails(deleteDoc(ref))
})

test('customers respond to workshop quotes without altering their prices', async () => {
  const alice = customer('alice'), ref = doc(alice, 'pcRequests/build')
  const request = { id: 'build', customerId: 'alice', customerEmail: 'alice@example.test', status: 'Under review', notes: '' }
  await assertFails(setDoc(ref, { ...request, quote: { amount: 1 } }))
  await assertSucceeds(setDoc(ref, request))
  await assertSucceeds(updateDoc(ref, { notes: 'Build notes' }))
  await assertFails(updateDoc(ref, { status: 'Approved' }))
  await assertSucceeds(updateDoc(doc(customer('owner'), 'pcRequests/build'), { status: 'Quoted', quote: { amount: 1000 } }))
  await assertFails(updateDoc(ref, { status: 'Approved', quote: { amount: 1 } }))
  await assertSucceeds(updateDoc(ref, { status: 'Approved' }))
  await assertFails(updateDoc(ref, { status: 'Under review' }))
  await assertFails(getDoc(doc(customer('bob'), 'pcRequests/build')))
})
