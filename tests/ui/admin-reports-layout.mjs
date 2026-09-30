import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('admin reports layout and period controls stay usable at responsive widths', { timeout: 90000 }, async () => {
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

    for (const width of [1440, 1170, 1024]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('http://127.0.0.1:5187/dashboard')
      const dashboardHeight = await page.locator('.admin-dashboard-hero').evaluate((element) => element.getBoundingClientRect().height)
      await page.goto('http://127.0.0.1:5187/reports')
      const reportHeight = await page.locator('.admin-reports-hero').evaluate((element) => element.getBoundingClientRect().height)
      assert.ok(Math.abs(reportHeight - dashboardHeight) <= 2, `Reports hero (${reportHeight}px) differs from dashboard (${dashboardHeight}px) at ${width}px`)
    }

    await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible()
    await expect(page.locator('.page-heading')).toHaveCount(0)
    await expect(page.locator('.report-highlight')).toHaveCount(0)
    await expect(page.locator('.admin-reports-summary-metrics > div')).toHaveCount(3)
    await expect(page.locator('.admin-reports-page .report-viz-card')).toHaveCount(11)
    await expect(page.locator('.report-viz-grid-operations .report-viz-card')).toHaveCount(4)
    await expect(page.locator('.report-viz-grid-finances .report-viz-card')).toHaveCount(7)
    await expect(page.locator('.report-donut')).toBeVisible()
    await expect(page.locator('.report-columns')).toHaveCount(1)
    await expect(page.getByText('No stock movements in this period.')).toBeVisible()
    await expect(page.locator('.report-trend-plot')).toBeVisible()
    await expect(page.locator('.report-viz-grid-finances .report-profit-step')).toHaveCount(4)
    await expect(page.locator('.report-viz-card button')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Service activity' }).locator('.report-donut-center')).toContainText('1')
    await expect(page.getByRole('region', { name: 'Payment collection' }).locator('.report-collection-head')).toContainText('100%')
    await expect(page.getByRole('region', { name: 'How revenue becomes profit' }).locator('.report-profit-step').last()).toContainText('550.00')
    await expect(page.locator('.admin-reports-hero-actions').getByRole('button', { name: 'Export Excel' })).toBeEnabled()

    for (const width of [1440, 1170, 1024, 900, 800, 600, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 700 : 900 })
      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector).getBoundingClientRect()
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
        }
        return {
          documentWidth: document.documentElement.scrollWidth,
          hero: rect('.admin-reports-hero'),
          actions: rect('.admin-reports-hero-actions'),
          summary: rect('.admin-reports-summary'),
          actionsClipped: (() => {
            const card = document.querySelector('.admin-reports-hero-actions')
            return card.scrollWidth > card.clientWidth + 1
          })(),
          panelsClipped: [...document.querySelectorAll('.admin-reports-page .report-viz-card')].some(
            (panel) => panel.scrollWidth > panel.clientWidth + 1,
          ),
          grids: [...document.querySelectorAll('.admin-reports-page .report-viz-grid')].map((element) => {
            const box = element.getBoundingClientRect()
            return { left: box.left, right: box.right }
          }),
          metricTransition: getComputedStyle(document.querySelector('.admin-reports-summary-metrics > div')).transitionDuration,
        }
      })
      assert.ok(layout.documentWidth <= width + 1, `Reports page overflows at ${width}px: ${JSON.stringify(layout)}`)
      assert.equal(layout.actionsClipped, false, `Report tools are clipped at ${width}px`)
      assert.equal(layout.panelsClipped, false, `Report panel content is clipped at ${width}px`)
      for (const box of [layout.hero, layout.actions, layout.summary, ...layout.grids])
        assert.ok(box.left >= -1 && box.right <= width + 1, `Reports section overflows at ${width}px: ${JSON.stringify(box)}`)
      assert.ok(layout.actions.top >= layout.hero.top - 1 && layout.actions.bottom <= layout.hero.bottom + 1, `Report tools leave the hero at ${width}px`)
      assert.equal(layout.metricTransition, '0s', 'reduced motion removes metric transitions')
    }

    await page.getByRole('combobox', { name: 'Report date range' }).selectOption('custom')
    const dates = page.getByRole('dialog', { name: 'Custom report dates' })
    await expect(dates).toBeVisible()
    for (const width of [1024, 600, 320]) {
      await page.setViewportSize({ width, height: 800 })
      const layout = await page.locator('.admin-reports-custom-range').evaluate((element) => ({
        documentWidth: document.documentElement.scrollWidth,
        panelWidth: element.clientWidth,
        contentWidth: element.scrollWidth,
      }))
      assert.ok(layout.documentWidth <= width + 1, `Custom range overflows at ${width}px`)
      assert.ok(layout.contentWidth <= layout.panelWidth + 1, `Custom range controls overflow at ${width}px`)
    }
    await dates.getByRole('textbox', { name: 'From date' }).fill('2026-01-15')
    await dates.getByRole('textbox', { name: 'To date' }).fill('2026-01-01')
    await expect(dates.getByText('The end date must be on or after the start date.')).toBeVisible()
    await expect(dates.getByRole('button', { name: 'Apply dates' })).toBeDisabled()
    await dates.getByRole('textbox', { name: 'To date' }).fill('2026-01-31')
    await dates.getByRole('button', { name: 'Apply dates' }).click()
    await expect(dates).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Edit dates/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeEnabled()
    await page.getByRole('combobox', { name: 'Report date range' }).selectOption('month')
    await page.getByRole('textbox', { name: 'Report month' }).fill('2026-02')
    await expect(page.getByRole('region', { name: 'Where sales originate' })).toContainText('No sales in this period.')
    await page.getByRole('button', { name: 'Export Excel' }).click()
    const preview = page.getByRole('dialog', { name: 'Excel preview' })
    await expect(preview).toBeVisible()
    await preview.getByRole('combobox', { name: 'Excel preview data rows per page' }).selectOption('25')
    await expect(preview.getByRole('table')).toContainText('2026-02-28')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('link', { name: 'Review low stock' })).toHaveAttribute('href', '/inventory?filter=low')
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server.close()
  }
})
