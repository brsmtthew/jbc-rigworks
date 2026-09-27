import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, mkdir } from 'node:fs/promises'
import { chromium, expect as baseExpect } from '@playwright/test'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc } from 'firebase/firestore'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Both local Firebase emulators are required.')
const projectId = 'demo-jbc-rigworks'
const expect = baseExpect.configure({ timeout: 15000 })
const origin = 'http://127.0.0.1:5179'
let env, browser, server
let serverOutput = ''
async function read(path) {
  let result
  await env.withSecurityRulesDisabled(async (context) => {
    result = (await getDoc(doc(context.firestore(), path))).data()
  })
  return result
}
async function list(path) {
  let result
  await env.withSecurityRulesDisabled(async (context) => {
    result = (await getDocs(collection(context.firestore(), path))).docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }))
  })
  return result
}
const confirm = (page, title, label) =>
  page
    .getByRole('dialog', { name: title, exact: true })
    .getByRole('button', { name: label, exact: true })
    .click()
async function register(page, name, email) {
  const verificationRequests = []
  const trackVerification = (request) => {
    if (request.url().includes('accounts:sendOobCode')) verificationRequests.push(request.url())
  }
  page.on('request', trackVerification)
  await page.goto(`${origin}/register`)
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/customer$/)
  const account = (await list('users')).find((user) => user.email === email)
  assert.equal(account.role, 'user')
  await expect(
    page.getByRole('button', { name: 'Send verification email', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'I verified my email', exact: true })).toHaveCount(
    0,
  )
  assert.deepEqual(verificationRequests, [])
  page.off('request', trackVerification)
  return account.id
}

async function verifyAdmin(page, id) {
  await expect(page.getByText(/Your account has been assigned an admin role/)).toBeVisible()
  await page.goto(`${origin}/dashboard`)
  await expect(page).toHaveURL(/\/customer$/)
  await page.getByRole('button', { name: 'Send verification email', exact: true }).click()
  await expect(page.getByText('Verification email sent.', { exact: true })).toBeVisible()
  const response = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: id, emailVerified: true }),
    },
  )
  assert.equal(response.status, 200, await response.text())
  await page.getByRole('button', { name: 'I verified my email', exact: true }).click()
  await expect(page.getByRole('button', { name: 'I verified my email', exact: true })).toHaveCount(
    0,
  )
}

before(
  async () => {
    env = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      },
    })
    await env.clearFirestore()
    await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`, {
      method: 'DELETE',
    })
    server = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'],
      {
        windowsHide: true,
        env: {
          ...process.env,
          VITE_FIREBASE_EMULATORS: 'true',
          VITE_FIREBASE_PROJECT_ID: projectId,
          VITE_FIREBASE_API_KEY: 'demo-key',
          VITE_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
          VITE_FIREBASE_APP_ID: 'demo-app',
          VITE_FIREBASE_STORAGE_BUCKET: `${projectId}.appspot.com`,
          VITE_FIREBASE_MESSAGING_SENDER_ID: '123456',
        },
      },
    )
    server.stdout.on('data', (data) => {
      serverOutput += data
    })
    server.stderr.on('data', (data) => {
      serverOutput += data
    })
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(origin)).status
          } catch {
            return 0
          }
        },
        { timeout: 30000, message: 'Vite must start' },
      )
      .toBe(200)
    browser = await chromium.launch({ channel: 'msedge', headless: true })
  },
  { timeout: 60000 },
)
after(async () => {
  await browser?.close()
  server?.kill()
  await env?.cleanup()
})

async function seed(path, data) {
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data))
}
async function operation(page, module, method, user, ...args) {
  return page.evaluate(
    async ({ module, method, user, args }) => {
      const modules = {
        orderOperations: 'pos/orderOperations',
        checkoutOperations: 'pos/checkoutOperations',
        customerOperations: 'customer/customerOperations',
        serviceOperations: 'services/serviceOperations',
        buildOperations: 'builder/buildOperations',
        payments: 'finance/payments',
      }
      const api = await import('/src/features/' + modules[module] + '.ts')
      return api[method](user, ...args)
    },
    { module, method, user, args },
  )
}

test('V2 customer, service, build, stock and POS workflows', { timeout: 240000 }, async () => {
  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const buyer = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  for (const page of [admin, buyer]) page.on('pageerror', (error) => errors.push(error.message))
  try {
    const adminId = await register(admin, 'Workshop owner', 'owner@example.test')
    await env.withSecurityRulesDisabled((context) =>
      updateDoc(doc(context.firestore(), 'users', adminId), { role: 'admin' }),
    )
    await verifyAdmin(admin, adminId)
    await expect(admin).toHaveURL(/\/dashboard$/)
    const buyerId = await register(buyer, 'Buyer', 'buyer@example.test')
    const staff = {
      id: adminId,
      role: 'admin',
      name: 'Workshop owner',
      email: 'owner@example.test',
    }
    const customer = { id: buyerId, role: 'user', name: 'Buyer', email: 'buyer@example.test' }
    const shop = await admin.evaluate(async () => {
      const { defaultShop } = await import('/src/lib/preferences.ts')
      return {
        ...defaultShop,
        delivery: 50,
        warrantyMonths: '3',
        services: [
          {
            id: 'clean',
            name: 'Standard Deep Cleaning',
            deviceType: 'Desktop',
            description: 'Thorough cleaning',
            inclusions: 'Dust removal',
            price: '799',
            durationMinutes: 120,
            workshop: true,
            home: true,
            active: true,
          },
        ],
      }
    })
    await seed('settings/shop', shop)
    await admin.goto(`${origin}/inventory`)
    await admin.getByRole('button', { name: 'Add item', exact: true }).click()
    const itemForm = admin.getByRole('dialog', { name: 'New inventory item' })
    for (const [name, value] of Object.entries({
      name: 'Test processor',
      brand: 'Test',
      model: 'CPU',
      sku: 'CPU-001',
      category: 'Processor',
      stock: '4',
      minimum: '1',
      cost: '60',
      price: '100',
    }))
      await itemForm.locator(`[name="${name}"]`).fill(value)
    await itemForm.getByLabel('PC component', { exact: true }).selectOption('Processor')
    await itemForm.getByLabel('CPU socket', { exact: true }).fill('AM5')
    await itemForm.getByRole('button', { name: 'Save item', exact: true }).click()
    await expect(itemForm).toHaveCount(0)
    const item = (await list('inventory'))[0]
    assert.equal(item.stock, 4)
    assert.equal((await read(`catalog/${item.id}`)).cost, 0)
    assert.equal((await list('stockMovements')).length, 1)

    await buyer.goto(`${origin}/customer/shop`)
    await buyer.getByRole('button', { name: 'Add Test CPU', exact: true }).click()
    await expect(buyer.getByText('Added to cart', { exact: true })).toBeVisible()
    await expect(buyer.getByRole('heading', { name: 'Current order' })).toHaveCount(0)
    await buyer.getByRole('button', { name: 'Cart (1)' }).click()
    await buyer
      .getByRole('dialog', { name: 'Your cart' })
      .getByRole('button', { name: 'Review checkout' })
      .click()
    const checkout = buyer.getByRole('dialog', { name: 'Review your order' })
    await checkout.getByRole('button', { name: 'Place order', exact: true }).click()
    await confirm(buyer, 'Place this order?', 'Place order')
    await expect(checkout).toHaveCount(0)
    const order = (await list('orders'))[0]
    assert.equal(order.status, 'Unpaid')
    assert.equal((await list('sales')).length, 0)
    assert.equal((await read(`inventory/${item.id}`)).stock, 4)
    await buyer.keyboard.press('Escape')
    await operation(admin, 'orderOperations', 'transitionOrder', staff, order.id, 'Confirmed')
    let stock = await read(`inventory/${item.id}`)
    assert.equal(stock.stock, 4)
    assert.equal(stock.reserved, 1)
    assert.equal((await list('sales')).length, 0)
    await assert.rejects(
      operation(admin, 'orderOperations', 'transitionOrder', staff, order.id, 'Completed'),
      /Cannot move/,
    )
    await assert.rejects(
      operation(admin, 'orderOperations', 'collectOrderPayment', staff, order.id, 50, {
        cashTendered: 50,
      }),
      /full remaining/,
    )
    const sale = await operation(
      admin,
      'orderOperations',
      'collectOrderPayment',
      staff,
      order.id,
      100,
      { cashTendered: 200 },
    )
    assert.equal(sale.id, order.id)
    assert.equal(sale.change, 100)
    assert.equal(sale.cost, 60)
    stock = await read(`inventory/${item.id}`)
    assert.equal(stock.stock, 3)
    assert.equal(stock.reserved, 0)
    await assert.rejects(
      operation(admin, 'orderOperations', 'collectOrderPayment', staff, order.id, 100, {
        cashTendered: 100,
      }),
      /already be paid/,
    )
    assert.equal((await list('receipts')).length, 1)
    for (const next of ['Processing', 'Ready', 'Completed'])
      await operation(admin, 'orderOperations', 'transitionOrder', staff, order.id, next)

    // Requested bookings do not occupy capacity; confirmations are serialized.
    const date = new Date()
    date.setUTCDate(date.getUTCDate() + 2)
    while ([0].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1)
    const appointmentDate = date.toISOString().slice(0, 10)
    await buyer.goto(`${origin}/customer/services`)
    await buyer.getByRole('button', { name: 'Choose service', exact: true }).click()
    await buyer.getByRole('button', { name: /Workshop Bring your device/ }).click()
    const bookingForm = buyer.getByRole('dialog', { name: 'Appointment details' })
    await bookingForm.getByLabel('Device brand/model').fill('ASUS desktop')
    await bookingForm.getByLabel('Preferred date').fill(appointmentDate)
    await bookingForm.getByLabel('Preferred time').selectOption({ index: 1 })
    await bookingForm.getByRole('button', { name: 'Submit request' }).click()
    await expect(bookingForm).toHaveCount(0)
    const appointment = (await list('appointments'))[0]
    await operation(
      admin,
      'serviceOperations',
      'updateAppointmentStatus',
      staff,
      appointment.id,
      'Confirmed',
    )
    const job = await operation(
      admin,
      'serviceOperations',
      'receiveAppointmentAsJob',
      staff,
      appointment.id,
    )
    assert.equal(job.status, 'Checked in')
    assert.equal(job.customerId, buyerId)
    assert.equal(
      (
        await operation(
          admin,
          'serviceOperations',
          'receiveAppointmentAsJob',
          staff,
          appointment.id,
        )
      ).id,
      job.id,
    )
    await assert.rejects(
      operation(admin, 'serviceOperations', 'advanceService', staff, job.id, 'Completed'),
      /Cannot move/,
    )
    await operation(admin, 'serviceOperations', 'advanceService', staff, job.id, 'In service')
    await operation(
      admin,
      'serviceOperations',
      'advanceService',
      staff,
      job.id,
      'Ready for checkout',
    )
    await admin.goto(`${origin}/jobs?tab=active`)
    await admin.getByRole('button', { name: 'Collect payment in POS' }).click()
    await admin.getByRole('button', { name: 'Review checkout' }).click()
    const pos = admin.getByRole('dialog', { name: 'Checkout', exact: true })
    await expect(pos.getByRole('button', { name: 'Complete sale' })).toBeDisabled()
    await pos.getByRole('button', { name: 'Exact', exact: true }).click()
    await pos.getByRole('button', { name: 'Complete sale', exact: true }).click()
    await confirm(admin, 'Complete this sale?', 'Complete sale')
    await expect(pos).toHaveCount(0)
    assert.equal((await read(`jobs/${job.id}`)).status, 'Ready for checkout')
    assert.equal((await read(`jobs/${job.id}`)).paymentStatus, 'Paid')
    await operation(admin, 'serviceOperations', 'advanceService', staff, job.id, 'Completed')
    assert.equal((await read(`appointments/${appointment.id}`)).status, 'Completed')
    await expect(
      admin.getByText('Keep this receipt for transaction and warranty reference.', {
        exact: false,
      }),
    ).toBeVisible()
    await admin.keyboard.press('Escape')

    const request = await operation(buyer, 'customerOperations', 'savePcRequest', customer, {
      useCase: 'Gaming',
      budget: '150',
      processor: 'Test CPU',
      graphics: 'Owned GPU',
      memory: '',
      storage: '',
      notes: 'Test build',
      parts: [
        { component: 'Processor', model: 'CPU', source: 'inventory', inventoryId: item.id },
        { component: 'Graphics', model: 'Owned GPU', source: 'customer_owned', price: 0 },
      ],
    })
    assert.equal((await read(`inventory/${item.id}`)).reserved, 0)
    await operation(admin, 'buildOperations', 'advanceBuild', staff, request.id, 'Under review')
    await operation(admin, 'customerOperations', 'savePcQuote', staff, buyerId, request.id, {
      amount: 150,
      message: 'CPU and assembly; GPU supplied by customer.',
    })
    await operation(
      buyer,
      'customerOperations',
      'respondToPcQuote',
      customer,
      request.id,
      'Approved',
    )
    const reserved = await operation(
      admin,
      'buildOperations',
      'advanceBuild',
      staff,
      request.id,
      'Parts reserved',
    )
    assert.equal((await read(`inventory/${item.id}`)).stock, 3)
    assert.equal((await read(`inventory/${item.id}`)).reserved, 1)
    await operation(admin, 'buildOperations', 'advanceBuild', staff, request.id, 'Assembly')
    await operation(admin, 'buildOperations', 'advanceBuild', staff, request.id, 'Ready')
    await operation(
      admin,
      'orderOperations',
      'collectOrderPayment',
      staff,
      reserved.transactionId,
      150,
      { cashTendered: 150 },
    )
    await operation(admin, 'buildOperations', 'advanceBuild', staff, request.id, 'Completed')
    assert.equal((await read(`inventory/${item.id}`)).stock, 2)

    const cancelled = await operation(buyer, 'customerOperations', 'savePcRequest', customer, {
      useCase: 'Work',
      budget: '',
      processor: '',
      graphics: '',
      memory: '',
      storage: '',
      notes: '',
    })
    await operation(
      buyer,
      'customerOperations',
      'changePendingRequest',
      customer,
      'requests',
      cancelled.id,
      null,
    )
    assert.equal((await read(`pcRequests/${cancelled.id}`)).status, 'Cancelled')
    assert.equal((await read(`pcRequests/${cancelled.id}`)).cancelledBy, buyerId)

    await mkdir('test-results/v2', { recursive: true })
    for (const [page, path, name] of [
      [admin, '/inventory', 'inventory'],
      [admin, '/reports', 'reports'],
      [buyer, '/customer/shop', 'shop'],
      [buyer, '/customer/pc-building', 'builder'],
    ]) {
      await page.goto(origin + path)
      await expect(page.locator('.page-content')).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      await page.screenshot({ path: `test-results/v2/${name}-desktop.png` })
      await page.setViewportSize({ width: 390, height: 844 })
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      await page.screenshot({ path: `test-results/v2/${name}-mobile.png` })
      await page.setViewportSize({ width: 1440, height: 1000 })
    }
    assert.deepEqual(errors, [])
  } catch (error) {
    await mkdir('test-results/v2', { recursive: true })
    await admin.screenshot({ path: 'test-results/v2/failure-admin.png' })
    await buyer.screenshot({ path: 'test-results/v2/failure-buyer.png' })
    throw error
  } finally {
    await admin.close()
    await buyer.close()
  }
})
