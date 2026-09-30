import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('admin services uses responsive record rows and keeps its workflows available', { timeout: 90000 }, async () => {
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
    await page.goto('http://127.0.0.1:5187/jobs')
    await expect(page.getByRole('heading', { name: 'Services', level: 1 })).toBeVisible()
    await expect(page.locator('.admin-services-hero-icon')).toHaveCount(0)
    await expect(page.locator('.page-heading')).toHaveCount(0)
    await expect(page.locator('.service-request-inbox .service-record-row')).toHaveCount(1)
    await expect(page.locator('.admin-services .jobs-grid')).toHaveCount(0)
    await expect(page.locator('.admin-services-hero-side')).toContainText('SERVICE ACTIVITY')
    await expect(page.locator('.admin-services-hero-side').getByRole('button', { name: 'Add walk-in service' })).toBeVisible()
    await expect(page.locator('.service-request-inbox .service-record-row')).not.toContainText('Customer notes')
    await expect(page.locator('.service-request-inbox .service-record-row')).not.toContainText('Printed intake and signatures required before service')
    await expect(page.locator('.service-request-inbox .service-record-actions button').first()).toHaveClass(/customer-record-action/)

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      const buttons = await page.locator('.service-request-inbox .service-record-actions button').evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect()
          return { left: box.left, right: box.right, top: box.top }
        }),
      )
      assert.equal(buttons.length, 4)
      assert.ok(Math.abs(buttons[0].top - buttons[1].top) < 2, `View and Review are not paired at ${width}px`)
      assert.ok(Math.abs(buttons[2].top - buttons[3].top) < 2, `Confirm and Cancel are not paired at ${width}px`)
      assert.ok(buttons[0].right <= buttons[1].left + 1, `First action row overlaps at ${width}px`)
      assert.ok(buttons[2].right <= buttons[3].left + 1, `Second action row overlaps at ${width}px`)
    }

    for (const width of [1440, 1170, 1024, 900, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector)
          const box = element.getBoundingClientRect()
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
        }
        return {
          documentWidth: document.documentElement.scrollWidth,
          hero: rect('.admin-services-hero'),
          heroCard: rect('.admin-services-hero-side'),
          controls: rect('.admin-services-controls'),
          tabs: rect('.admin-services-tabs'),
          search: rect('.admin-services-filters .search-field'),
          row: rect('.service-request-inbox .service-record-row'),
          main: rect('.service-request-inbox .service-record-main'),
          actions: rect('.service-request-inbox .service-record-actions'),
          transition: getComputedStyle(document.querySelector('.service-record-row')).transitionDuration,
        }
      })
      assert.ok(layout.documentWidth <= width + 1, `Services overflows at ${width}px: ${JSON.stringify(layout)}`)
      for (const key of ['hero', 'heroCard', 'controls', 'row', 'main', 'actions'])
        assert.ok(layout[key].left >= -1 && layout[key].right <= width + 1, `${key} overflows at ${width}px`)
      if (width > 700)
        assert.ok(Math.abs((layout.tabs.top + layout.tabs.bottom) / 2 - (layout.search.top + layout.search.bottom) / 2) < 4, `Tabs and search split into rows at ${width}px: ${JSON.stringify(layout)}`)
      if (width > 900)
        assert.ok(layout.actions.left >= layout.main.right - 1, `Actions are not beside the record at ${width}px`)
      else
        assert.ok(layout.actions.top >= layout.main.bottom - 1, `Actions are not below the record at ${width}px`)
      assert.equal(layout.transition, '0s', 'reduced motion removes row transitions')
    }

    await page.getByRole('searchbox', { name: 'Search appointments' }).fill('not-a-customer')
    await expect(page.locator('.service-request-inbox .service-record-row')).toHaveCount(0)
    await expect(page.getByText('No appointments match your search')).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search appointments' }).fill('Jamie')
    await expect(page.locator('.service-request-inbox .service-record-row')).toHaveCount(1)
    await page.getByRole('button', { name: 'View appointment APT-fixture' }).click()
    const details = page.getByRole('dialog', { name: 'Appointment details' })
    await expect(details).toContainText('Jamie Santos')
    await expect(details).toContainText('Fan noise and high temperature')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Review schedule & estimate' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.evaluate(async () => {
      const { collections } = await import('/tests/ui/fixtures/data.ts')
      collections.appointments.push({
        ...collections.appointments[0],
        id: 'APT-cancelled-fixture',
        customerName: 'Cancelled customer',
        status: 'Cancelled',
        cancelledAt: '2026-09-29T09:00:00.000Z',
      })
      collections.appointments.push({
        ...collections.appointments[0],
        id: 'APT-visit-fixture',
        customerName: 'Visit customer',
        visit: {
          mode: 'Workshop', address: '', distanceKm: 0,
          basePrice: 799, surcharge: 0, transport: 0, taxRate: 12, estimate: 894.88,
        },
      })
    })
    await page.getByRole('button', { name: 'Active jobs' }).click()
    await page.getByRole('button', { name: 'Requests / appointments' }).click()
    const cancelled = page.locator('.service-request-inbox .service-record-row').filter({ hasText: 'APT-cancelled-fixture' })
    await expect(cancelled).toBeVisible()
    await expect(cancelled.locator('.service-record-actions button')).toHaveCount(1)
    await cancelled.getByRole('button', { name: 'View appointment APT-cancelled-fixture' }).click()
    const cancelledDetails = page.getByRole('dialog', { name: 'Appointment details' })
    await expect(cancelledDetails).toContainText('Cancelled customer')
    await expect(cancelledDetails).toContainText('Cancellation')
    await page.keyboard.press('Escape')

    const visit = page.locator('.service-request-inbox .service-record-row').filter({ hasText: 'APT-visit-fixture' })
    await expect(visit.locator('.service-record-actions button')).toHaveCount(5)
    await expect(visit.getByRole('button', { name: 'Review / print intake' })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 900 })
    const visitLayout = await visit.locator('.service-record-actions button').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top }
      }),
    )
    assert.ok(Math.abs(visitLayout[0].top - visitLayout[1].top) < 2)
    assert.ok(visitLayout[2].top < visitLayout[3].top && visitLayout[3].top < visitLayout[4].top)
    assert.ok(visitLayout[3].left <= visitLayout[0].left + 1 && visitLayout[3].right >= visitLayout[1].right - 1)
    await page.evaluate(async () => {
      const { collections } = await import('/tests/ui/fixtures/data.ts')
      collections.appointments.find((item) => item.id === 'APT-visit-fixture').status = 'Confirmed'
    })
    await page.getByRole('button', { name: 'Active jobs' }).click()
    await page.getByRole('button', { name: 'Requests / appointments' }).click()
    await expect(visit.locator('.service-record-actions button')).toHaveCount(6)
    const confirmedLayout = await visit.locator('.service-record-actions button').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top }
      }),
    )
    assert.ok(confirmedLayout[2].left <= confirmedLayout[0].left + 1 && confirmedLayout[2].right >= confirmedLayout[1].right - 1)
    assert.ok(confirmedLayout[3].left <= confirmedLayout[0].left + 1 && confirmedLayout[3].right >= confirmedLayout[1].right - 1)
    assert.ok(Math.abs(confirmedLayout[4].top - confirmedLayout[5].top) < 2)
    assert.ok(confirmedLayout[4].right <= confirmedLayout[5].left + 1)
    await visit.getByRole('button', { name: 'No show' }).click()
    const noShow = page.getByRole('dialog', { name: 'Mark customer as no-show?' })
    await expect(noShow).toContainText('reserved time is released')
    await noShow.getByRole('button', { name: 'Cancel', exact: true }).click()

    await page.getByRole('button', { name: 'Active jobs' }).click()
    await expect(page.locator('.admin-services-list .service-record-row')).toHaveCount(1)
    for (const width of [1440, 1170, 1024, 900, 768]) {
      await page.setViewportSize({ width, height: 900 })
      const positions = await page.evaluate(() => {
        const center = (selector) => {
          const box = document.querySelector(selector).getBoundingClientRect()
          return (box.top + box.bottom) / 2
        }
        return [center('.admin-services-tabs'), center('.admin-services-filters .search-field'), center('.admin-services-filters .admin-filter-label')]
      })
      assert.ok(Math.max(...positions) - Math.min(...positions) < 4, `Active controls split into rows at ${width}px: ${positions}`)
    }
    for (const width of [1440, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      const layout = await page.evaluate(() => {
        const row = document.querySelector('.admin-services-list .service-record-row')
        const actions = row.querySelector('.service-record-actions')
        return {
          documentWidth: document.documentElement.scrollWidth,
          rowRight: row.getBoundingClientRect().right,
          actionsRight: actions.getBoundingClientRect().right,
        }
      })
      assert.ok(layout.documentWidth <= width + 1, `Active jobs overflow at ${width}px`)
      assert.ok(layout.rowRight <= width + 1 && layout.actionsRight <= width + 1)
      const activeButtons = await page.locator('.admin-services-list .service-record-actions button').evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().top),
      )
      assert.ok(Math.abs(activeButtons[0] - activeButtons[1]) < 2, `Active job actions are not paired at ${width}px`)
    }
    await page.getByRole('button', { name: 'Review intake & quote' }).click()
    await expect(page.getByRole('dialog', { name: 'Edit service job' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Completed' }).click()
    await expect(page.getByText('No services in this view')).toBeVisible()
    await page.getByRole('button', { name: 'Add walk-in service' }).click()
    const walkIn = page.getByRole('dialog', { name: 'New walk-in service' })
    await expect(walkIn).toBeVisible()
    await expect(walkIn.getByLabel('Workshop service')).toBeVisible()
    await expect(walkIn.getByText('WALK-IN CUSTOMER')).toBeVisible()
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 760 })
      const layout = await page.evaluate(() => {
        const dialog = document.querySelector('.app-dialog:has(.walkin-form)').getBoundingClientRect()
        const footer = document.querySelector('.app-dialog:has(.walkin-form) .dialog-footer').getBoundingClientRect()
        return { documentWidth: document.documentElement.scrollWidth, dialogRight: dialog.right, footerBottom: footer.bottom }
      })
      assert.ok(layout.documentWidth <= width + 1, `Walk-in form overflows at ${width}px`)
      assert.ok(layout.dialogRight <= width + 1 && layout.footerBottom <= 761, `Walk-in dialog is clipped at ${width}px`)
    }
    await walkIn.getByLabel('Workshop service').selectOption({ label: 'Standard Deep Cleaning / Desktop' })
    await walkIn.getByLabel('Device brand / model').fill('Lenovo ThinkCentre M720')
    await walkIn.getByRole('button', { name: 'Continue' }).click()
    await expect(walkIn.getByRole('heading', { name: 'Device intake' })).toBeVisible()
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 760 })
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      assert.ok(documentWidth <= width + 1, `Device intake overflows at ${width}px`)
    }
    await walkIn.getByLabel('Customer name').fill('Walk-in customer')
    await walkIn.getByLabel('Mobile number').fill('09171234567')
    await walkIn.getByLabel('Describe visible condition or wear').fill('Minor scratches on the case')
    await walkIn.getByLabel('Existing hardware or performance issues').fill('Dusty fans')
    await walkIn.getByLabel('Condition and issue history').fill('No previous repair')
    await walkIn.getByRole('button', { name: 'Continue' }).click()
    await expect(walkIn.getByRole('heading', { name: 'Review & save' })).toBeVisible()
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 760 })
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      assert.ok(documentWidth <= width + 1, `Walk-in review overflows at ${width}px`)
    }
    await expect(walkIn.getByText('No online appointment approval is needed.')).toBeVisible()
    await expect(walkIn.getByRole('button', { name: 'Save & open POS' })).toBeEnabled()
    await page.keyboard.press('Escape')
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server.close()
  }
})
