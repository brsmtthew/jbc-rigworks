import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('service details, optional charges, compact cards, and completed intake actions work at desktop and mobile widths', { timeout: 90000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    await page.route(/\.(?:png|jpe?g|webp|gif|avif)(?:\?|$)/i, (route) => route.abort())

    await page.goto('http://127.0.0.1:5187/customer/services')
    await page.evaluate(async () => {
      const { shop } = await import('/tests/ui/fixtures/data.ts')
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 2
      shop.services[0].image = canvas.toDataURL('image/jpeg')
      shop.services[0].additionalCharges = [{ id: 'paste', name: 'Thermal paste replacement', price: '250' }]
    })
    await page.getByPlaceholder('Search services').fill('Standard')
    await expect(page.locator('.service-card-image')).toHaveCount(1)
    const bookingCards = page.locator('.service-price-card')
    await expect(bookingCards.first().getByRole('button', { name: 'View details' })).toBeVisible()
    await bookingCards.first().getByRole('button', { name: 'View details' }).click()
    await expect(page.getByRole('dialog')).toContainText('Service estimate')
    await page.keyboard.press('Escape')
    await bookingCards.first().getByRole('button', { name: 'Choose service' }).click()
    const booking = page.getByRole('dialog', { name: 'Standard Deep Cleaning' })
    const extra = booking.getByRole('checkbox', { name: /Thermal paste replacement/ })
    await expect(extra).toBeVisible()
    await extra.check()
    await expect(booking.locator('.booking-additional-total')).toContainText('₱250.00')
    await booking.locator('.visit-option').first().click()
    await expect(booking.locator('.booking-modal-summary')).toContainText('₱952.00')
    await page.setViewportSize({ width: 320, height: 900 })
    assert.ok(await booking.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1))
    await extra.uncheck()
    await expect(booking.locator('.booking-modal-summary')).toContainText('₱672.00')
    await page.keyboard.press('Escape')
    await bookingCards.first().locator('h2').evaluate((element) => { element.textContent = 'A very long service name '.repeat(30) })
    await bookingCards.first().locator('p').first().evaluate((element) => { element.textContent = 'A long service description '.repeat(80) })
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      const measurements = await bookingCards.evaluateAll((cards) => cards.map((card) => ({
        height: card.getBoundingClientRect().height,
        buttonBottom: card.querySelector('button:last-of-type').getBoundingClientRect().bottom,
        cardBottom: card.getBoundingClientRect().bottom,
      })))
      assert.ok(measurements.every((card) => card.height === measurements[0].height))
      assert.ok(measurements.every((card) => card.buttonBottom <= card.cardBottom + 1))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    }

    await page.goto('http://127.0.0.1:5187/pos')
    await page.evaluate(async () => {
      const { shop } = await import('/tests/ui/fixtures/data.ts')
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 2
      shop.services[0].image = canvas.toDataURL('image/jpeg')
    })
    await page.getByRole('button', { name: 'Services', exact: true }).click()
    await expect(page.locator('.admin-pos-product .product-image')).toHaveCount(1)
    const posCards = page.locator('.admin-pos-product')
    await expect(posCards.first().getByRole('button', { name: /View details/ })).toBeVisible()
    await posCards.first().getByRole('button', { name: /View details/ }).click()
    await expect(page.getByRole('dialog')).toContainText('Service estimate')
    await page.keyboard.press('Escape')
    await posCards.first().locator('h2').evaluate((element) => { element.textContent = 'A very long POS service name '.repeat(30) })
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      const measurements = await posCards.evaluateAll((cards) => cards.map((card) => ({
        height: card.getBoundingClientRect().height,
        buttonBottom: card.querySelector('button:last-of-type').getBoundingClientRect().bottom,
        cardBottom: card.getBoundingClientRect().bottom,
      })))
      assert.ok(measurements.every((card) => card.height === measurements[0].height))
      assert.ok(measurements.every((card) => card.buttonBottom <= card.cardBottom + 1))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    }
    await page.evaluate(async () => {
      const { shop } = await import('/tests/ui/fixtures/data.ts')
      for (const service of shop.services)
        service.additionalCharges = [{ id: 'paste', name: 'Thermal paste replacement', price: '250' }]
    })
    await posCards.first().getByRole('button', { name: /Add to order/ }).click()
    await page.getByRole('button', { name: 'Review checkout' }).click()
    const checkout = page.getByRole('dialog', { name: 'Checkout' })
    await checkout.locator('.charge-details summary').click()
    await checkout.getByRole('checkbox', { name: /Thermal paste replacement/ }).check()
    await expect(checkout.getByLabel('Other charges (PHP)')).toHaveValue('250')

    await page.goto('http://127.0.0.1:5187/jobs?tab=active')
    await expect(page.getByRole('button', { name: 'Mark ready' })).toHaveCount(0)
    await page.evaluate(async () => {
      const { collections } = await import('/tests/ui/fixtures/data.ts')
      const original = collections.jobs[0]
      original.status = 'Completed'
      original.paymentStatus = 'Paid'
      original.channel = 'Walk-in'
      collections.jobs.push({ ...original, id: 'JOB-workshop', channel: 'Online', appointmentId: 'APT-fixture' })
      collections.appointments.push({ ...collections.appointments[0], id: 'APT-home', visit: { mode: 'Home service', address: 'Manila', distanceKm: 1, basePrice: 700, surcharge: 0, transport: 0, taxRate: 0 } })
      collections.jobs.push({ ...original, id: 'JOB-home', channel: 'Online', appointmentId: 'APT-home' })
    })
    await page.getByRole('button', { name: 'Completed', exact: true }).click()
    const completed = page.locator('.admin-services-list .service-record-row')
    await expect(completed).toHaveCount(3)
    await expect(completed.getByRole('button', { name: 'Review / print intake' })).toHaveCount(3)
    await completed.last().getByRole('button', { name: 'Review / print intake' }).click()
    await expect(page.getByRole('dialog', { name: 'Customer intake & service authorization' })).toContainText('Home service')
    await expect(page.getByRole('button', { name: 'Print form' })).toBeVisible()
    await page.goto('http://127.0.0.1:5187/settings')
    await page.getByRole('button', { name: 'Booking & scheduling' }).click()
    const schedule = page.getByRole('dialog', { name: 'Booking & scheduling' })
    await schedule.getByRole('button', { name: 'Add date override' }).click()
    const capacity = schedule.getByLabel('Available bookings')
    await expect(capacity).toHaveValue('')
    await capacity.fill('5')
    await capacity.fill('')
    await expect(capacity).toHaveValue('')
    await capacity.fill('0')
    await expect(capacity).toHaveValue('0')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Service catalog' }).click()
    const catalog = page.getByRole('dialog', { name: 'Service catalog' })
    const firstService = catalog.locator('.service-catalog-card').first()
    await firstService.getByRole('button', { name: 'Deactivate' }).click()
    await expect(firstService).toContainText('Inactive')
    await firstService.getByRole('button', { name: 'Activate', exact: true }).click()
    await firstService.getByRole('button', { name: 'Edit' }).click()
    const editor = page.getByRole('dialog', { name: 'Edit service' })
    await expect(editor.getByLabel('Service image')).toBeVisible()
    await editor.getByRole('button', { name: 'Add charge' }).click()
    await editor.getByLabel('Charge name').fill('Thermal paste replacement')
    await editor.getByLabel('Price (PHP)', { exact: true }).fill('250')
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 2
      const context = canvas.getContext('2d')
      context.fillStyle = '#2563eb'
      context.fillRect(0, 0, 2, 2)
      return canvas.toDataURL('image/png').split(',')[1]
    })
    await editor.getByLabel('Service image').setInputFiles({
      name: 'service.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    })
    await expect(editor.locator('.upload-preview img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
    await editor.getByRole('button', { name: 'Save service' }).click()
    await expect(firstService.locator('.service-catalog-card-image')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
    await firstService.getByRole('button', { name: 'View' }).click()
    await expect(page.getByRole('dialog', { name: /Standard Deep Cleaning/ })).toContainText('Thermal paste replacement')
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server.close()
  }
})
