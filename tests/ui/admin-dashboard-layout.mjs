import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('admin dashboard charts and navigation fit desktop and phone layouts', { timeout: 90000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    await page.goto('http://127.0.0.1:5187/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    await expect(page.locator('.admin-dashboard-hero')).toBeVisible()
    await expect(page.locator('.admin-dashboard-hero-icon')).toHaveCount(0)
    await expect(page.locator('.page-heading')).toHaveCount(0)
    await expect(page.locator('.admin-dashboard-hero').getByLabel('Report period')).toBeVisible()
    await expect(page.locator('.trend-chart svg')).toBeVisible()
    await expect(page.locator('.channel-donut')).toBeVisible()
    await expect(page.locator('.service-chart-bars')).toBeVisible()
    assert.ok(await page.locator('.trend-line-sales').count(), 'monthly trend has a line series')
    await page.locator('.trend-chart-plot rect').first().focus()
    await expect(page.locator('.trend-chart-summary')).toContainText('Sales')
    assert.match(
      await page.locator('.channel-donut').evaluate((element) => getComputedStyle(element).backgroundImage),
      /conic-gradient/,
      'channel chart renders as a donut',
    )
    for (const width of [1440, 1024, 768, 540, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 700 : 900 })
      const layout = await page.evaluate(() => {
        const bounds = (selector) => [...document.querySelectorAll(selector)].map((element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right, width: rect.width }
        })
        return {
          pageWidth: document.documentElement.scrollWidth,
          topbar: bounds('.topbar'),
          hero: bounds('.admin-dashboard-hero, .admin-dashboard-period'),
          cards: bounds('.admin-dashboard .metric-card, .admin-dashboard .panel, .admin-dashboard .admin-queue-grid'),
          donut: bounds('.channel-donut'),
          sidebar: bounds('.app-sidebar'),
          motion: getComputedStyle(document.querySelector('.admin-dashboard .metric-card')).transitionDuration,
        }
      })
      assert.ok(layout.pageWidth <= width + 1, `document overflows at ${width}: ${JSON.stringify(layout)}`)
      for (const box of [...layout.topbar, ...layout.hero, ...layout.cards, ...layout.donut]) {
        assert.ok(box.left >= -1 && box.right <= width + 1 && box.width > 0, `element overflows at ${width}: ${JSON.stringify(box)}`)
      }
      assert.equal(layout.motion, '0s', 'reduced motion removes card transitions')
      if (width <= 1024) {
        await page.getByRole('button', { name: 'Open navigation' }).click()
        const drawer = page.getByRole('dialog', { name: 'Navigation' })
        await expect(drawer.getByRole('link', { name: 'Inventory', exact: true })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(drawer).toHaveCount(0)
      } else {
        assert.equal(layout.sidebar[0].width, 258)
        await page.getByRole('button', { name: 'Collapse sidebar' }).click()
        await expect(page.locator('.app-sidebar')).toHaveCSS('width', '76px')
        await page.getByRole('button', { name: 'Expand sidebar' }).click()
        await expect(page.locator('.app-sidebar')).toHaveCSS('width', '258px')
      }
    }
  } finally {
    await browser?.close()
    await server.close()
  }
})
