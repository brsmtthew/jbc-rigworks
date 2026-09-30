import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seed, read } from './memory-db.mjs'
import { today } from '../../src/lib/dates.ts'
import { savePcQuote, respondToPcQuote } from '../../src/features/customer/customerOperations.ts'
import { updateAppointmentStatus } from '../../src/features/services/serviceOperations.ts'

const admin = { id: 'admin', role: 'admin' }
const customer = { id: 'buyer', role: 'user' }

test('a final quote needs a positive amount and available submitted parts, then records customer approval', async () => {
  const request = {
    id: 'build', customerId: customer.id, status: 'Under review',
    useCase: 'Work', budget: '30000', createdAt: new Date().toISOString(),
    parts: [],
  }
  seed({ 'pcRequests/build': request })
  await assert.rejects(savePcQuote(admin, customer.id, 'build', { amount: 0, message: 'Parts and labor' }), /valid quote amount/)
  await assert.rejects(savePcQuote(admin, customer.id, 'build', { amount: 1000, message: 'Parts and labor' }), /component selections/)

  seed({ 'pcRequests/build': { ...request, parts: [{ component: 'CPU', model: 'Missing', source: 'Stock', inventoryId: 'missing' }] } })
  await assert.rejects(savePcQuote(admin, customer.id, 'build', { amount: 1000, message: 'Parts and labor' }), /unavailable/)

  seed({ 'pcRequests/build': { ...request, parts: [{ component: 'CPU', model: 'Customer CPU', source: 'Custom' }] } })
  await savePcQuote(admin, customer.id, 'build', { amount: 1000, message: 'Parts and labor' })
  assert.equal(read('pcRequests/build').status, 'Quoted')
  await respondToPcQuote(customer, 'build', 'Approved')
  assert.equal(read('pcRequests/build').status, 'Approved')
  assert.equal(read('pcRequests/build').approvedBy, customer.id)
  assert.ok(read('pcRequests/build').approvedAt)
})

test('a future service appointment cannot be marked as a no-show', async () => {
  const next = new Date(`${today()}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  seed({
    'appointments/future': {
      id: 'future', status: 'Confirmed', preferredDate: next.toISOString().slice(0, 10),
      preferredTime: '09:00–11:00', service: 'Cleaning', device: 'Desktop',
    },
  })
  await assert.rejects(updateAppointmentStatus(admin, 'future', 'No show'), /future appointment/)
  assert.equal(read('appointments/future').status, 'Confirmed')
})
