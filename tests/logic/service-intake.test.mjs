import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  emptyServiceIntake,
  intakeTypeForService,
  validateServiceIntake,
} from '../../src/features/customer/serviceIntake.ts'
import { ServiceIntakeDocument } from '../../src/features/customer/ServiceIntakeDocument.tsx'
import {
  changePendingRequest,
  saveAppointment,
} from '../../src/features/customer/customerOperations.ts'
import {
  advanceService,
  receiveAppointmentAsJob,
  recordSignedServiceIntake,
  recordSignedWalkInIntake,
  reviewAppointment,
  saveServiceJob,
  updateAppointmentStatus,
} from '../../src/features/services/serviceOperations.ts'
import { createWalkInJob } from '../../src/features/services/walkInJob.ts'
import { walkInDocumentAppointment } from '../../src/features/services/walkInDocument.ts'
import { checkout } from '../../src/features/pos/checkoutOperations.ts'
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

test('service-specific intake questions are validated and device print fields follow the selected type', () => {
  const base = {
    ...emptyServiceIntake,
    customerName: 'Jamie',
    contactPhone: '09171234567',
    visibleCondition: 'No damage',
    reportedIssues: 'Unknown',
    issueHistory: 'New request',
  }
  assert.equal(intakeTypeForService('service-2', 'PC Assembly'), 'assembly')
  assert.throws(() => validateServiceIntake({ ...base, serviceType: 'assembly' }), /assembly parts/)
  assert.throws(() => validateServiceIntake({ ...base, serviceType: 'diagnosis' }), /symptoms/)
  assert.throws(
    () => validateServiceIntake({ ...base, serviceType: 'upgrade' }),
    /current hardware/,
  )
  assert.doesNotThrow(() =>
    validateServiceIntake({
      ...base,
      reportedIssues: '',
      issueHistory: '',
      serviceType: 'assembly',
      assemblyParts: 'Customer supplied CPU, board and case',
      assemblyGoal: 'Workstation',
    }),
  )
  const laptop = {
    ...base,
    deviceType: 'Laptop',
    laptopBattery: 'Weak',
    laptopDisplay: 'No cracks',
  }
  const html = renderToStaticMarkup(
    createElement(ServiceIntakeDocument, {
      appointment: {
        id: 'APT-laptop',
        service: 'Diagnosis & Repair',
        serviceId: 'service-0',
        device: 'Laptop',
        preferredDate: '2026-10-10',
        preferredTime: '09:00–11:00',
        notes: '',
        serviceIntake: { ...laptop, serviceType: 'diagnosis', diagnosisSymptoms: 'Won’t boot' },
      },
    }),
  )
  assert.match(html, /Battery condition/)
  assert.match(html, /Symptoms to diagnose/)
  assert.doesNotMatch(html, /Motherboard/)
})

test('pending bookings hold capacity immediately and editing moves the hold', async () => {
  const shop = normalizeShop(defaultShop)
  seed({ 'settings/shop': shop })
  const service = shop.services.find((item) => item.workshop && item.active)
  const customer = { id: 'customer-1', name: 'Jamie', email: 'jamie@example.test', role: 'user' }
  const intake = {
    ...emptyServiceIntake,
    customerName: 'Jamie',
    contactPhone: '09171234567',
    visibleCondition: 'No damage',
    reportedIssues: 'Fan noise',
    issueHistory: 'Last week',
  }
  const date = '2099-01-05'
  const [first, second, third] = availableWindows(date, shop.schedule, [], service.durationMinutes)
  assert.ok(
    !availableWindows(
      date,
      { ...shop.schedule, dateOverrides: [{ date, windowId: first.id, capacity: 0 }] },
      [],
      service.durationMinutes,
    ).some((window) => window.id === first.id),
  )
  const request = {
    serviceId: service.id,
    service: service.name,
    device: 'Desktop',
    preferredDate: date,
    preferredTime: slotLabel(first),
    notes: '',
    serviceIntake: intake,
    visit: {
      mode: 'Workshop',
      address: '',
      distanceKm: 0,
      basePrice: null,
      surcharge: null,
      transport: null,
      taxRate: 0,
      estimate: null,
    },
  }
  const saved = await saveAppointment(customer, request)
  assert.equal(read(`appointmentSlots/${saved.slotId}`).count, 1)
  await assert.rejects(saveAppointment(customer, request), /now booked/)
  await updateAppointmentStatus(admin, saved.id, 'Confirmed')
  assert.equal(read(`appointmentSlots/${saved.slotId}`).count, 1)
  await assert.rejects(
    changePendingRequest(customer, 'appointments', saved.id, null),
    /being processed/,
  )
  const pending = await saveAppointment(customer, { ...request, preferredTime: slotLabel(second) })
  await assert.rejects(
    changePendingRequest(customer, 'appointments', pending.id, {
      notes: 'Updated',
      preferredDate: date,
      preferredTime: slotLabel(first),
      device: 'Desktop',
      serviceIntake: intake,
    }),
    /Choose an available appointment window/,
  )
  await changePendingRequest(customer, 'appointments', pending.id, {
    notes: 'Updated',
    preferredDate: date,
    preferredTime: slotLabel(third),
    device: 'Desktop',
    serviceIntake: intake,
  })
  assert.equal(read(`appointmentSlots/${date}_${second.id}`).count, 0)
  assert.equal(read(`appointmentSlots/${date}_${third.id}`).count, 1)
  await changePendingRequest(customer, 'appointments', pending.id, null)
  assert.equal(read(`appointmentSlots/${date}_${third.id}`).count, 0)
  const acknowledged = await saveAppointment(customer, {
    ...request,
    preferredTime: slotLabel(third),
  })
  await reviewAppointment(admin, acknowledged.id, {
    date,
    time: slotLabel(third),
    note: 'Schedule reviewed with customer',
  })
  assert.equal(read(`appointments/${acknowledged.id}`).status, 'Requested')
  await assert.rejects(
    changePendingRequest(customer, 'appointments', acknowledged.id, null),
    /being processed/,
  )
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
    customerName: 'Jamie Santos',
    contactPhone: '09171234567',
    visibleCondition: 'Small scratch',
    reportedIssues: 'Fan noise',
    issueHistory: 'Started last month',
  }
  const booking = {
    serviceId: offering.id,
    service: offering.name,
    device: 'ASUS desktop',
    specifications: '',
    unknownSpecifications: true,
    preferredDate: appointmentDate,
    preferredTime: slotLabel(windows[0]),
    notes: 'Cleaning requested',
    visit: {
      mode: 'Home service',
      address: '123 Manila Street',
      distanceKm: 0,
      basePrice: null,
      surcharge: null,
      transport: null,
      taxRate: shop.taxRate,
      estimate: null,
    },
  }
  const customer = {
    id: 'customer-1',
    name: 'Account Name',
    email: 'jamie@example.test',
    role: 'user',
  }
  for (const [index, mode] of ['Home service', 'Workshop'].entries()) {
    const request = {
      ...booking,
      preferredTime: slotLabel(windows[index]),
      visit: { ...booking.visit, mode, address: mode === 'Workshop' ? '' : booking.visit.address },
    }
    await assert.rejects(saveAppointment(customer, request), /Complete the device intake/)
    const saved = await saveAppointment(customer, { ...request, serviceIntake: intake })
    assert.equal(saved.customerName, 'Jamie Santos')
    assert.equal(read(`appointments/${saved.id}`).serviceIntake.visibleCondition, 'Small scratch')
    assert.equal(read(`appointments/${saved.id}`).intakeSignedAt, undefined)
  }
})

test('home service cannot start until staff record the signed paper intake', async () => {
  const appointment = {
    id: 'APT-home',
    status: 'Confirmed',
    customerId: 'customer-1',
    customerName: 'Jamie Santos',
    customerEmail: 'jamie@example.test',
    service: 'Standard Deep Cleaning',
    device: 'ASUS desktop',
    preferredDate: '2026-10-10',
    preferredTime: '09:00–11:00',
    notes: 'Fan noise',
    visit: {
      mode: 'Home service',
      address: '123 Manila Street',
      distanceKm: 0,
      basePrice: 600,
      surcharge: 0,
      transport: 0,
      taxRate: 0,
      estimate: 600,
    },
  }
  seed({ 'appointments/APT-home': appointment })
  await assert.rejects(receiveAppointmentAsJob(admin, appointment.id), /collect signatures/)
  assert.equal(read('jobs/JOB-APT-home'), undefined)
  await assert.rejects(
    recordSignedServiceIntake({ id: 'customer-1', role: 'user' }, appointment.id),
    /Only JBC/,
  )
  await recordSignedServiceIntake(admin, appointment.id)
  assert.equal(read('appointments/APT-home').intakeSignedBy, admin.id)
  const job = await receiveAppointmentAsJob(admin, appointment.id)
  assert.equal(job.status, 'In service')
  assert.equal(read('appointments/APT-home').jobId, job.id)
})

test('workshop check-in requires the signed paper intake', async () => {
  const appointment = {
    id: 'APT-workshop',
    status: 'Confirmed',
    customerId: 'customer-1',
    customerName: 'Jamie Santos',
    customerEmail: 'jamie@example.test',
    service: 'Standard Deep Cleaning',
    device: 'ASUS desktop',
    preferredDate: '2026-10-10',
    preferredTime: '09:00–11:00',
    notes: '',
    visit: {
      mode: 'Workshop',
      address: '',
      distanceKm: 0,
      basePrice: 600,
      surcharge: 0,
      transport: 0,
      taxRate: 0,
      estimate: 600,
    },
  }
  seed({ 'appointments/APT-workshop': appointment })
  await assert.rejects(receiveAppointmentAsJob(admin, appointment.id), /collect signatures/)
  await recordSignedServiceIntake(admin, appointment.id)
  const job = await receiveAppointmentAsJob(admin, appointment.id)
  assert.equal(job.status, 'Checked in')
})

test('printed workshop authorization includes the named intake and omits later payment and test sections', () => {
  const appointment = {
    id: 'APT-print',
    createdAt: '2026-09-28T00:00:00.000Z',
    customerName: 'Jamie Santos',
    customerEmail: 'jamie@example.test',
    device: 'ThinkPad T14',
    service: 'Deep Cleaning',
    preferredDate: '2026-10-10',
    preferredTime: '09:00–11:00',
    notes: 'Fan noise',
    visit: { mode: 'Workshop', address: '' },
    serviceIntake: {
      ...emptyServiceIntake,
      customerName: 'Jamie Santos',
      contactPhone: '09171234567',
      cpu: 'Core i5',
      visibleDamage: ['Scratches'],
      visibleCondition: 'Scratch on lid',
      reportedIssues: 'Fan noise',
      issueHistory: 'Started last month',
    },
  }
  const html = renderToStaticMarkup(createElement(ServiceIntakeDocument, { appointment }))
  for (const text of [
    'Jamie Santos',
    'Core i5',
    'Scratch on lid',
    'Before-service documentation',
    'Customer authorization',
    'Customer signature',
    'Workshop',
  ])
    assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /Payment|Test results \/ notes/i)
  const olderHome = {
    ...appointment,
    visit: { mode: 'Home service', address: '123 Manila Street' },
    serviceIntake: undefined,
    homeIntake: appointment.serviceIntake,
  }
  const homeHtml = renderToStaticMarkup(
    createElement(ServiceIntakeDocument, { appointment: olderHome }),
  )
  assert.match(homeHtml, /123 Manila Street/)
  assert.match(homeHtml, /Jamie Santos/)
})

test('walk-in intake checks in directly, prints with the customer name, and can be paid before signed service starts', async () => {
  const settings = { ...normalizeShop(defaultShop), taxRate: 0 }
  seed({ 'settings/shop': settings })
  const offering = settings.services.find((service) => service.active && service.workshop && service.deviceType === 'Desktop')
  assert.ok(offering)
  const intake = {
    ...emptyServiceIntake,
    customerName: 'Jamie Santos',
    contactPhone: '09171234567',
    visibleCondition: 'Small scratch on case',
    reportedIssues: 'Dusty fans',
    issueHistory: 'No prior repair',
  }
  const job = createWalkInJob({
    id: 'JOB-WALKIN',
    offering,
    intake,
    device: 'ThinkCentre M720',
    due: '2099-01-05',
    quote: 799,
    confirmedAt: '2026-09-29T00:00:00.000Z',
  })
  await saveServiceJob(admin, job)
  const saved = read('jobs/JOB-WALKIN')
  assert.equal(saved.channel, 'Walk-in')
  assert.equal(saved.status, 'Checked in')
  assert.ok(saved.confirmedAt)
  assert.equal(saved.serviceIntake.visibleCondition, 'Small scratch on case')
  await assert.rejects(advanceService(admin, job.id, 'In service'), /signed walk-in intake/)
  const appointment = walkInDocumentAppointment(saved)
  assert.notEqual(appointment.preferredDate, job.due)
  const html = renderToStaticMarkup(createElement(ServiceIntakeDocument, { appointment, walkIn: true }))
  assert.match(html, /Jamie Santos/)
  assert.match(html, /Method:.*Walk-in/)
  assert.match(html, /Small scratch on case/)
  assert.doesNotMatch(html, /2099-01-05/)
  const sale = await checkout(admin, {
    idempotencyKey: 'walkin-payment',
    customer: saved.customer,
    contact: saved.contact,
    paymentMethod: 'Cash',
    paid: 799,
    cashTendered: 799,
    lines: [{ id: `job-service:${job.id}`, quantity: 1 }],
    customServices: [{ id: `job-service:${job.id}`, description: saved.service, unitPrice: 799 }],
    jobId: job.id,
    charges: { labor: 0, delivery: 0, other: 0, otherLabel: '', discount: 0, taxRate: 0 },
    notes: '',
  })
  assert.equal(sale.orderStatus, 'Processing')
  assert.equal(read('jobs/JOB-WALKIN').paymentStatus, 'Paid')
  await assert.rejects(recordSignedWalkInIntake({ id: 'customer', role: 'user' }, job.id), /Only JBC/)
  await recordSignedWalkInIntake(admin, job.id)
  assert.equal(read('jobs/JOB-WALKIN').intakeSignedBy, admin.id)
  await advanceService(admin, job.id, 'In service')
  assert.equal(read('jobs/JOB-WALKIN').status, 'In service')
})
