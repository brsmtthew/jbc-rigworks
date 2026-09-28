import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyServiceIntake, validateServiceIntake } from '../../src/features/customer/serviceIntake.ts'
import { ServiceIntakeDocument } from '../../src/features/customer/ServiceIntakeDocument.tsx'
import { saveAppointment } from '../../src/features/customer/customerOperations.ts'
import { receiveAppointmentAsJob, recordSignedServiceIntake } from '../../src/features/services/serviceOperations.ts'
import { availableWindows, slotLabel } from '../../src/features/services/serviceCatalog.ts'
import { defaultShop, normalizeShop } from '../../src/lib/shopSettings.ts'
import { read, seed } from './memory-db.mjs'

const admin = { id: 'tech-1', role: 'admin' }

test('service intake requires condition and history before it can be saved', () => {
  const complete = {
    ...emptyServiceIntake,
    customerName: ' Jamie Santos ',
    contactPhone: ' 09171234567 ',
    visibleCondition: ' Small scratch ',
    reportedIssues: ' Fan noise ',
    issueHistory: ' Started last month ',
  }
  assert.throws(() => validateServiceIntake(undefined), /Complete the device intake/)
  assert.throws(() => validateServiceIntake({ ...complete, visibleCondition: ' ' }), /condition/)
  assert.equal(validateServiceIntake(complete).customerName, 'Jamie Santos')
  assert.equal(validateServiceIntake(complete).visibleCondition, 'Small scratch')
})

test('home and workshop appointments save the named device intake with their booking records', async () => {
  const shop = normalizeShop(defaultShop)
  seed({ 'settings/shop': shop })
  const offering = shop.services.find((service) => service.home && service.active)
  assert.ok(offering)
  const date = new Date(Date.now() + 8 * 86400000)
  let windows = []
  let appointmentDate = ''
  for (let attempt = 0; attempt < 10 && !windows.length; attempt++) {
    appointmentDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date)
    windows = availableWindows(appointmentDate, shop.schedule, [], offering.durationMinutes)
    date.setUTCDate(date.getUTCDate() + 1)
  }
  assert.ok(windows.length)
  const intake = {
    ...emptyServiceIntake,
    customerName: 'Jamie Santos', contactPhone: '09171234567', visibleCondition: 'Small scratch',
    reportedIssues: 'Fan noise', issueHistory: 'Started last month',
  }
  const booking = {
    serviceId: offering.id, service: offering.name, device: 'ASUS desktop',
    specifications: '', unknownSpecifications: true, preferredDate: appointmentDate,
    preferredTime: slotLabel(windows[0]), notes: 'Cleaning requested',
    visit: { mode: 'Home service', address: '123 Manila Street', distanceKm: 0,
      basePrice: null, surcharge: null, transport: null, taxRate: shop.taxRate, estimate: null },
  }
  const customer = { id: 'customer-1', name: 'Account Name', email: 'jamie@example.test', role: 'user' }
  for (const mode of ['Home service', 'Workshop']) {
    const request = { ...booking, visit: { ...booking.visit, mode, address: mode === 'Workshop' ? '' : booking.visit.address } }
    await assert.rejects(saveAppointment(customer, request), /Complete the device intake/)
    const saved = await saveAppointment(customer, { ...request, serviceIntake: intake })
    assert.equal(saved.customerName, 'Jamie Santos')
    assert.equal(read(`appointments/${saved.id}`).serviceIntake.visibleCondition, 'Small scratch')
    assert.equal(read(`appointments/${saved.id}`).intakeSignedAt, undefined)
  }
})

test('home service cannot start until staff record the signed paper intake', async () => {
  const appointment = {
    id: 'APT-home', status: 'Confirmed', customerId: 'customer-1',
    customerName: 'Jamie Santos', customerEmail: 'jamie@example.test',
    service: 'Standard Deep Cleaning', device: 'ASUS desktop',
    preferredDate: '2026-10-10', preferredTime: '09:00–11:00', notes: 'Fan noise',
    visit: { mode: 'Home service', address: '123 Manila Street', distanceKm: 0,
      basePrice: 600, surcharge: 0, transport: 0, taxRate: 0, estimate: 600 },
  }
  seed({ 'appointments/APT-home': appointment })
  await assert.rejects(receiveAppointmentAsJob(admin, appointment.id), /collect signatures/)
  assert.equal(read('jobs/JOB-APT-home'), undefined)
  await assert.rejects(recordSignedServiceIntake({ id: 'customer-1', role: 'user' }, appointment.id), /Only JBC/)
  await recordSignedServiceIntake(admin, appointment.id)
  assert.equal(read('appointments/APT-home').intakeSignedBy, admin.id)
  const job = await receiveAppointmentAsJob(admin, appointment.id)
  assert.equal(job.status, 'In service')
  assert.equal(read('appointments/APT-home').jobId, job.id)
})

test('workshop check-in requires the signed paper intake', async () => {
  const appointment = {
    id: 'APT-workshop', status: 'Confirmed', customerId: 'customer-1',
    customerName: 'Jamie Santos', customerEmail: 'jamie@example.test',
    service: 'Standard Deep Cleaning', device: 'ASUS desktop',
    preferredDate: '2026-10-10', preferredTime: '09:00–11:00', notes: '',
    visit: { mode: 'Workshop', address: '', distanceKm: 0, basePrice: 600,
      surcharge: 0, transport: 0, taxRate: 0, estimate: 600 },
  }
  seed({ 'appointments/APT-workshop': appointment })
  await assert.rejects(receiveAppointmentAsJob(admin, appointment.id), /collect signatures/)
  await recordSignedServiceIntake(admin, appointment.id)
  const job = await receiveAppointmentAsJob(admin, appointment.id)
  assert.equal(job.status, 'Checked in')
})

test('printed workshop authorization includes the named intake and omits later payment and test sections', () => {
  const appointment = {
    id: 'APT-print', createdAt: '2026-09-28T00:00:00.000Z', customerName: 'Jamie Santos',
    customerEmail: 'jamie@example.test', device: 'ThinkPad T14', service: 'Deep Cleaning',
    preferredDate: '2026-10-10', preferredTime: '09:00–11:00', notes: 'Fan noise',
    visit: { mode: 'Workshop', address: '' },
    serviceIntake: { ...emptyServiceIntake, customerName: 'Jamie Santos',
      contactPhone: '09171234567', cpu: 'Core i5', visibleDamage: ['Scratches'],
      visibleCondition: 'Scratch on lid', reportedIssues: 'Fan noise', issueHistory: 'Started last month' },
  }
  const html = renderToStaticMarkup(createElement(ServiceIntakeDocument, { appointment }))
  for (const text of ['Jamie Santos', 'Core i5', 'Scratch on lid', 'Before-service documentation',
    'Customer authorization', 'Customer signature', 'Workshop']) assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /Payment|Test results \/ notes/i)
  const olderHome = { ...appointment, visit: { mode: 'Home service', address: '123 Manila Street' },
    serviceIntake: undefined, homeIntake: appointment.serviceIntake }
  const homeHtml = renderToStaticMarkup(createElement(ServiceIntakeDocument, { appointment: olderHome }))
  assert.match(homeHtml, /123 Manila Street/)
  assert.match(homeHtml, /Jamie Santos/)
})
