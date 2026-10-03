import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('admin POS catalog, cart, and dialogs fit across viewport sizes', { timeout: 90000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    for (const width of [1440, 1170, 1024]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('http://127.0.0.1:5187/dashboard')
      const dashboardHeroHeight = await page.locator('.admin-dashboard-hero').evaluate((element) => element.getBoundingClientRect().height)
      await page.goto('http://127.0.0.1:5187/pos')
      const posHeroHeight = await page.locator('.admin-pos-overview').evaluate((element) => element.getBoundingClientRect().height)
      assert.ok(Math.abs(posHeroHeight - dashboardHeroHeight) <= 2, `POS hero (${posHeroHeight}px) differs from dashboard (${dashboardHeroHeight}px) at ${width}px`)
    }
    await expect(page.getByRole('heading', { name: 'Point of sale', level: 1 })).toBeVisible()
    await expect(page.locator('.admin-pos-overview-icon')).toHaveCount(0)
    await expect(page.locator('.page-heading')).toHaveCount(0)
    await expect(page.locator('.admin-pos-overview-actions').getByRole('button')).toHaveCount(2)
    await expect(page.locator('.admin-pos-overview-side')).toContainText('COUNTER TOOLS')
    await expect(page.locator('.admin-pos-product').first()).toBeVisible()
    await expect(page.locator('.admin-pos-cart')).toBeVisible()

    for (const width of [1440, 1170, 1024, 900, 768, 600, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 700 : 900 })
      const layout = await page.evaluate(() => {
        const bounds = (selector) => [...document.querySelectorAll(selector)].map((element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right, width: rect.width }
        })
        return {
          scrollWidth: document.documentElement.scrollWidth,
          sections: bounds('.admin-pos-overview, .admin-pos-overview-side, .admin-pos-overview-actions > button, .admin-pos-discovery, .admin-pos-cart, .admin-pos-product'),
          filter: bounds('.admin-pos-type-filter'),
          productTransition: getComputedStyle(document.querySelector('.admin-pos-product')).transitionDuration,
        }
      })
      assert.ok(layout.scrollWidth <= width + 1, `POS page overflows at ${width}: ${JSON.stringify(layout)}`)
      for (const box of [...layout.sections, ...layout.filter])
        assert.ok(box.left >= -1 && box.right <= width + 1 && box.width > 0, `POS section overflows at ${width}: ${JSON.stringify(box)}`)
      assert.equal(layout.productTransition, '0s', 'reduced motion removes product card transitions')
    }

    await expect(page.getByRole('button', { name: 'Services', exact: true })).toHaveCount(0)
    await expect(page.locator('.admin-pos-product').filter({ hasText: 'Workshop service' })).toHaveCount(0)
    await page.locator('.admin-pos-product .admin-pos-add:not([disabled])').first().click()
    await expect(page.locator('.admin-pos-cart .cart-line')).toHaveCount(1)
    await page.getByRole('button', { name: 'Review checkout' }).click()
    const checkout = page.getByRole('dialog', { name: 'Checkout' })
    await expect(checkout.getByRole('heading', { name: 'Customer details' })).toBeVisible()
    await expect(checkout.getByRole('heading', { name: 'Sale summary' })).toBeVisible()
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 650 : 850 })
      const modal = await checkout.evaluate((dialog) => {
        const rect = dialog.getBoundingClientRect()
        const content = dialog.querySelector('.admin-pos-checkout').getBoundingClientRect()
        return { viewport: innerWidth, left: rect.left, right: rect.right, dialogWidth: dialog.clientWidth, scrollWidth: dialog.scrollWidth, contentLeft: content.left, contentRight: content.right }
      })
      assert.ok(modal.left >= -1 && modal.right <= width + 1, `checkout dialog overflows at ${width}: ${JSON.stringify(modal)}`)
      assert.ok(modal.scrollWidth <= modal.dialogWidth + 1, `checkout content overflows at ${width}: ${JSON.stringify(modal)}`)
      assert.ok(modal.contentLeft >= modal.left - 1 && modal.contentRight <= modal.right + 1)
    }
    await page.keyboard.press('Escape')
    await expect(checkout).toHaveCount(0)

    await page.getByRole('button', { name: 'Scan order QR' }).click()
    const scanner = page.getByRole('dialog', { name: 'Scan customer order' })
    await expect(scanner.getByRole('textbox', { name: 'Order QR or reference' })).toBeVisible()
    await expect(scanner.getByRole('region', { name: 'Scan with camera' })).toBeVisible()
    await expect(scanner.getByRole('region', { name: 'Upload order QR' })).toBeVisible()
    for (const width of [900, 390, 320]) {
      await page.setViewportSize({ width, height: 700 })
      const layout = await scanner.evaluate((dialog) => ({
        left: dialog.getBoundingClientRect().left,
        right: dialog.getBoundingClientRect().right,
        scrollWidth: dialog.scrollWidth,
        clientWidth: dialog.clientWidth,
      }))
      assert.ok(layout.left >= -1 && layout.right <= width + 1 && layout.scrollWidth <= layout.clientWidth + 1, `Scanner dialog overflows at ${width}: ${JSON.stringify(layout)}`)
    }
    await page.keyboard.press('Escape')
    await expect(scanner).toHaveCount(0)

    await page.getByRole('button', { name: 'Bundles & PC sets' }).click()
    const bundles = page.locator('.admin-pos-inline-bundles')
    await expect(bundles.locator('.bundle-catalog .pos-product').first()).toBeVisible()
    for (const width of [900, 390, 320]) {
      await page.setViewportSize({ width, height: 700 })
      const modal = await bundles.evaluate((section) => ({
        width: section.clientWidth,
        scrollWidth: section.scrollWidth,
        right: section.getBoundingClientRect().right,
      }))
      assert.ok(modal.scrollWidth <= modal.width + 1 && modal.right <= width + 1)
    }
    await page.getByRole('button', { name: 'All items' }).click()
    await expect(bundles).toHaveCount(0)

    await page.getByRole('button', { name: 'Online orders' }).click()
    const orders = page.getByRole('dialog', { name: 'Online orders' })
    await expect(orders).toBeVisible()
    await expect(orders.locator('.admin-online-order')).toHaveCount(2)
    await orders.getByRole('button', { name: 'In progress' }).click()
    await expect(orders.locator('.admin-online-order')).toHaveCount(1)
    await orders.getByRole('searchbox', { name: 'Search online orders' }).fill('INV-pending')
    await expect(orders.locator('.admin-online-order')).toHaveCount(1)
    for (const width of [900, 390, 320]) {
      await page.setViewportSize({ width, height: 700 })
      const layout = await orders.evaluate((dialog) => ({
        left: dialog.getBoundingClientRect().left,
        right: dialog.getBoundingClientRect().right,
        scrollWidth: dialog.scrollWidth,
        clientWidth: dialog.clientWidth,
      }))
      assert.ok(layout.left >= -1 && layout.right <= width + 1 && layout.scrollWidth <= layout.clientWidth + 1, `Online orders dialog overflows at ${width}: ${JSON.stringify(layout)}`)
    }
    await orders.getByRole('button', { name: 'Open in POS' }).click()
    await expect(page.getByRole('heading', { name: 'Collect payment', level: 1 })).toBeVisible()
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 700 })
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        cards: [...document.querySelectorAll('.cashier-screen > .panel')].map((element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right }
        }),
      }))
      assert.ok(layout.scrollWidth <= width + 1, `payment screen overflows at ${width}`)
      for (const card of layout.cards)
        assert.ok(card.left >= -1 && card.right <= width + 1, `payment card overflows at ${width}`)
    }
  } finally {
    await browser?.close()
    await server.close()
  }
})
