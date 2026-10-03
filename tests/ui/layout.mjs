import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('isolated responsive pages and modal interactions', { timeout: 180000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    await mkdir('test-results/ui', { recursive: true })
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of [
        '/customer/shop',
        '/customer/services',
        '/customer/records',
        '/customer/pc-building',
        '/dashboard',
        '/inventory',
        '/sales',
        '/expenses',
        '/jobs',
        '/pos',
        '/reports',
        '/settings',
        '/pc-building',
      ]) {
        await page.goto(`http://127.0.0.1:5187${path}`)
        await expect(page.locator('.page-content').getByRole('heading').first()).toBeVisible()
        await expect(page.getByText('Loading page...', { exact: true })).toHaveCount(0)
        if (path === '/customer/pc-building') {
          await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible()
          await expect(page.locator('.pc-3d-builder')).toHaveCount(0)
        } else if (path === '/pc-building') {
          await page.getByRole('button', { name: 'Builder tool', exact: true }).click()
          await expect(page.locator('.pc-3d-builder canvas')).toBeVisible({ timeout: 15000 })
          await expect(page.locator('h1')).toHaveCount(1)
        }
        const overflow = await page.evaluate(() => ({
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          main: document.querySelector('.page-content')?.scrollWidth,
          mainWidth: document.querySelector('.page-content')?.clientWidth,
        }))
        assert.ok(
          overflow.document <= width + 1,
          `${path} viewport ${width} overflow: ${JSON.stringify(overflow)}`,
        )
        assert.ok(
          overflow.main <= overflow.mainWidth + 1,
          `${path} main overflow ${width}: ${JSON.stringify(overflow)}`,
        )
        await page.evaluate(async () => {
          await Promise.all(
            document
              .getAnimations()
              .filter((a) => a.effect?.getTiming().iterations !== Infinity)
              .map((a) => a.finished),
          )
        })
        await page.screenshot({ path: `test-results/ui/${path.replaceAll('/', '-')}-${width}.png` })
        if (path === '/dashboard') {
          const headingTop = await page
            .locator('h1')
            .evaluate((el) => el.getBoundingClientRect().top)
          await page.locator('.page-content').evaluate((el) => {
            el.scrollTop = 200
          })
          const afterScroll = await page
            .locator('h1')
            .evaluate((el) => el.getBoundingClientRect().top)
          assert.ok(afterScroll < headingTop - 100, 'Page heading scrolls away with content')
        }
        if (path === '/inventory' && width > 800) {
          const itemWidth = await page
            .locator('.item-cell')
            .first()
            .evaluate((el) => el.getBoundingClientRect().width)
          assert.ok(itemWidth >= 200, 'Inventory names have readable column widths')
        }
      }
      await page.goto('http://127.0.0.1:5187/jobs')
      await page.getByRole('button', { name: 'Active jobs', exact: true }).click()
      await page.getByRole('searchbox', { name: 'Search services' }).fill('no matching device')
      await expect(page.getByText('No services in this view', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Clear search', exact: true }).click()
      await page.screenshot({ path: `test-results/ui/services-active-${width}.png` })
      await page.goto('http://127.0.0.1:5187/settings')
      await page.getByRole('button', { name: 'Business & invoices', exact: false }).click()
      await expect(page.getByRole('dialog').locator('.dialog-footer')).toBeInViewport()
      await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeInViewport()
      await page.screenshot({ path: `test-results/ui/business-settings-${width}.png` })
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Booking & scheduling', exact: false }).click()
      await expect(page.getByRole('heading', { name: 'Window 1', exact: true })).toBeVisible()
      const modalOverflow = await page
        .getByRole('dialog')
        .locator('.dialog-body')
        .evaluate((el) => el.scrollWidth - el.clientWidth)
      assert.ok(modalOverflow <= 1, `Scheduling dialog overflows at ${width}px`)
      await page.screenshot({ path: `test-results/ui/booking-settings-${width}.png` })
      await page.keyboard.press('Escape')
      for (const name of [
        'Home service, delivery & warranty',
        'Service catalog',
        'Company payment QRs',
        'Reference data & taxes',
      ]) {
        await page
          .getByRole('button', {
            name: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          })
          .click()
        const modal = page.getByRole('dialog').last()
        await expect(modal).toBeVisible()
        assert.ok(
          await modal
            .locator('.dialog-body')
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          `${name}: dialog fits ${width}px`,
        )
        if (name === 'Reference data & taxes') {
          await modal.getByRole('button', { name: /^Inventory categories/ }).click()
          const nested = page.getByRole('dialog').last()
          await expect(nested).toBeVisible()
          await nested.locator('.dialog-body').evaluate((el) => {
            el.scrollTop = el.scrollHeight
          })
          const action = nested.getByRole('button', { name: 'Add value', exact: true })
          await expect(action).toBeInViewport()
          const within = await action.evaluate((el) => {
            const b = el.getBoundingClientRect()
            const d = el.closest('dialog').getBoundingClientRect()
            return b.left >= d.left && b.right < d.right
          })
          assert.ok(within, 'Reference data action stays inside the dialog')
          await page.screenshot({ path: `test-results/ui/reference-values-${width}.png` })
          await page.keyboard.press('Escape')
        }
        await page.keyboard.press('Escape')
      }
      for (const [route, button, title] of [
        ['inventory', 'Add item', 'New inventory item'],
        ['expenses', 'Record expense', 'New expense'],
        ['jobs', 'Add walk-in service', 'New walk-in service'],
      ]) {
        await page.goto(`http://127.0.0.1:5187/${route}`)
        await page.getByRole('button', { name: button, exact: true }).click()
        const modal = page.getByRole('dialog', { name: title, exact: true })
        await expect(modal.locator('.dialog-footer')).toBeInViewport()
        await modal.locator('.dialog-body').evaluate((el) => {
          el.scrollTop = el.scrollHeight
        })
        await expect(modal.locator('.dialog-footer')).toBeInViewport()
        await page.screenshot({ path: `test-results/ui/${route}-editor-${width}.png` })
        await page.keyboard.press('Escape')
        await expect(page.getByRole('button', { name: button, exact: true })).toBeFocused()
      }
      await page.goto('http://127.0.0.1:5187/customer/shop')
      await page
        .getByRole('button', { name: /^Add to cart:/ })
        .first()
        .click()
      await page.getByRole('button', { name: width > 1060 ? 'View cart' : /Cart \(1\)/ }).click()
      await page.getByRole('button', { name: 'Review checkout', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      const footer = dialog.locator('.dialog-footer')
      await expect(footer).toBeInViewport()
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await page.screenshot({ path: `test-results/ui/checkout-${width}.png` })
      await expect(dialog).toHaveCSS('opacity', '1')
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await page.goto('http://127.0.0.1:5187/customer/services')
      await page.getByRole('button', { name: 'Choose service', exact: true }).first().click()
      await page.getByRole('button', { name: /Workshop Bring/ }).click()
      await expect(page.getByRole('dialog').locator('.dialog-footer')).toBeInViewport()
      await page.screenshot({ path: `test-results/ui/booking-${width}.png` })
    }
    await page.goto('http://127.0.0.1:5187/pos')
    await page.getByRole('button', { name: 'Online orders', exact: true }).click()
    await page.getByRole('button', { name: 'Open in POS', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Collect payment', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Back to POS', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
    assert.deepEqual(errors, [], 'No uncaught browser errors')
  } finally {
    await browser?.close()
    await server.close()
  }
})
