import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  availableStock,
  assertTransition,
  serviceTransitions,
  buildTransitions,
  orderTransitions,
  serviceState,
  isRecognizedSale,
} from '../../src/lib/workflow.ts'
import { invoiceTotals } from '../../src/lib/commerce.ts'
import {
  availableWindows,
  defaultSchedule,
  slotKey,
  adaptServices,
} from '../../src/features/services/serviceCatalog.ts'
import { compatibility, compatibilitySummary } from '../../src/features/builder/pc.ts'
import { qualifyingBundle, bundlePriceAdjustment, warrantyFor } from '../../src/lib/fulfillment.ts'
import { getSummary } from '../../src/features/finance/summary.ts'
import { defaultShop, normalizeShop } from '../../src/lib/shopSettings.ts'
import { formAmount } from '../../src/lib/forms.ts'

test('required amounts reject blanks, negative and non-finite input; optional estimates allow blanks', () => {
  const form = new FormData()
  for (const value of ['', '   ', '-1', 'Infinity', 'abc']) {
    form.set('amount', value)
    assert.throws(() => formAmount(form, 'amount'), /valid non-negative amount/)
  }
  form.set('amount', '')
  assert.equal(formAmount(form, 'amount', true), 0)
  form.set('amount', ' 123.45 ')
  assert.equal(formAmount(form, 'amount'), 123.45)
})

const part = (component, fields = {}) => ({
  id: component,
  name: component,
  component,
  category: component,
  kind: 'part',
  stock: 5,
  reserved: 0,
  price: 1000,
  cost: 600,
  minimum: 1,
  sku: component,
  ...fields,
})

test('power display waits for base components and actual CPU/GPU ratings', () => {
  assert.equal(compatibilitySummary([]).powerEstimateReady, false)
  const base = ['Processor', 'Motherboard', 'Memory', 'Storage'].map((component) => part(component))
  assert.equal(compatibilitySummary(base).powerEstimateReady, false)
  base[0].powerDraw = 65
  assert.equal(compatibilitySummary(base).powerEstimateReady, true)
  assert.equal(compatibilitySummary([...base, part('Graphics')]).powerEstimateReady, false)
  assert.equal(
    compatibilitySummary([...base, part('Graphics', { powerDraw: 150 })]).powerEstimateReady,
    true,
  )
})

test('reservations reduce availability without changing physical stock', () => {
  const item = part('Processor', { reserved: 3 })
  assert.equal(availableStock(item), 2)
  assert.equal(item.stock, 5)
  assert.equal(availableStock({ ...item, stock: 2 }), 0)
})
test('workflow graphs block premature completion and duplicate actions', () => {
  for (const [graph, from, next] of [
    [serviceTransitions, 'Requested', 'Completed'],
    [buildTransitions, 'Approved', 'Completed'],
    [orderTransitions, 'Requested', 'Completed'],
    [orderTransitions, 'Confirmed', 'Confirmed'],
  ])
    assert.throws(() => assertTransition(graph, from, next))
  assert.doesNotThrow(() => assertTransition(buildTransitions, 'Approved', 'Parts reserved'))
  assert.equal(serviceState('Ready'), 'Ready for checkout')
  assert.equal(serviceState('In progress'), 'In service')
  assert.deepEqual(serviceTransitions['In service'], ['Completed'])
  assert.deepEqual(normalizeShop({ services: [] }).services, [])
  assert.deepEqual(normalizeShop({}).services, [])
})
test('schedule applies capacity, duration, holidays, blocked hours and local time', () => {
  const date = '2030-01-07',
    now = new Date('2030-01-06T00:00:00Z')
  assert.equal(availableWindows(date, defaultSchedule, [], 120, now).length, 4)
  assert.equal(
    availableWindows(date, defaultSchedule, [{ id: slotKey(date, 'morning'), count: 1 }], 120, now)
      .length,
    3,
  )
  assert.equal(
    availableWindows(date, { ...defaultSchedule, blockedDates: [date] }, [], 120, now).length,
    0,
  )
  assert.equal(availableWindows(date, defaultSchedule, [], 180, now).length, 0)
  assert.equal(
    availableWindows(
      date,
      { ...defaultSchedule, blockedPeriods: [{ date, start: '10:00', end: '12:00' }] },
      [],
      120,
      now,
    ).length,
    2,
  )
  assert.equal(availableWindows('2030-01-06', defaultSchedule, [], 120, now).length, 0)
  assert.equal(
    availableWindows(date, defaultSchedule, [], 120, new Date('2030-01-07T06:00:00Z')).length,
    1,
  )
})
test('legacy cleaning prices adapt without tier names in new service offerings', () => {
  const services = adaptServices({ Desktop: { Low: '500', Mid: '900', High: '1400' } })
  assert.equal(services[0].price, '500')
  assert.ok(services.every((service) => !/Low|Mid|High/.test(service.name)))
  assert.equal(normalizeShop({ taxRate: 200 }).taxRate, 100)
})
test('compatibility rejects known conflicts and never treats missing specs as compatible', () => {
  assert.equal(compatibilitySummary([]).status, 'Not yet checked')
  assert.equal(compatibilitySummary([part('Processor')]).status, 'Needs attention')
  const items = [
    part('Processor', { socket: 'AM5', powerDraw: 100 }),
    part('Motherboard', {
      socket: 'AM4',
      memoryType: 'DDR4',
      formFactor: 'ATX',
      storageInterfaces: 'SATA',
    }),
    part('Memory', { memoryType: 'DDR5' }),
    part('Case', { supportedFormFactors: 'ITX', gpuClearanceMm: 200, coolerClearanceMm: 100 }),
    part('Graphics', { lengthMm: 300, recommendedPsu: 800 }),
    part('Power supply', { wattage: 400 }),
    part('Cooling', { heightMm: 150, supportedSockets: 'LGA1700' }),
    part('Storage', { storageInterface: 'NVMe' }),
  ]
  assert.equal(compatibility(items).length, 8)
  assert.equal(compatibilitySummary(items).status, 'Incompatible')
})
test('bundle price is applied once and unpublished bundles cannot qualify', () => {
  const items = [part('Processor'), part('Motherboard')]
  const bundle = {
    id: 'b',
    name: 'Starter',
    price: 1700,
    items: items.map((item) => ({ inventoryId: item.id, quantity: 1 })),
    active: true,
    published: true,
  }
  const lines = items.map((item) => ({ id: item.id, quantity: 1 }))
  assert.equal(qualifyingBundle(lines, items, [bundle], 'b'), 'Starter')
  assert.equal(qualifyingBundle(lines, items, [{ ...bundle, published: false }], 'b'), null)
  assert.equal(qualifyingBundle(lines.slice(0, 1), items, [bundle], 'b'), null)
  assert.deepEqual(bundlePriceAdjustment(bundle, items), {
    discount: 300,
    other: 0,
    otherLabel: '',
  })
  const totals = invoiceTotals(
    items.map((item) => ({ ...item, quantity: 1, unitPrice: item.price })),
    { labor: 0, delivery: 100, taxRate: 12, ...bundlePriceAdjustment(bundle, items) },
  )
  assert.equal(totals.total, 2016)
})
test('financial totals recognize full payments, snapshot COGS and non-voided expenses', () => {
  const paid = {
    id: 'sale',
    date: '2030-01-07',
    total: 1120,
    paid: 1120,
    cost: 600,
    status: 'Paid',
    orderStatus: 'Ready',
    charges: { tax: 120 },
  }
  assert.ok(isRecognizedSale(paid))
  const summary = getSummary('2030-01', {
    sales: [
      paid,
      { ...paid, status: 'Unpaid', paid: 0 },
      { ...paid, status: 'Partial', paid: 100 },
      { ...paid, orderStatus: 'Cancelled' },
    ],
    expenses: [
      { date: '2030-01-07', amount: 100 },
      { date: '2030-01-07', amount: 200, voided: true },
    ],
  })
  assert.equal(summary.revenue, 1000)
  assert.equal(summary.cost, 600)
  assert.equal(summary.spent, 100)
  assert.equal(summary.profit, 300)
  assert.equal(summary.sales.length, 1)
})
test('warranty expiry clamps month ends and preserves invoice settings', () => {
  assert.equal(
    warrantyFor(part('Processor', { warrantyMonths: '1' }), defaultShop, '2030-01-31').expires,
    '2030-02-28',
  )
  assert.equal(warrantyFor(part('Processor'), defaultShop, '2030-01-31').expires, null)
})
