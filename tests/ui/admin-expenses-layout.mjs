import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('admin expenses tools, filters, and ledger fit responsive layouts', { timeout: 90000 }, async () => {
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
      await page.goto('http://127.0.0.1:5187/expenses')
      const expenseHeight = await page.locator('.admin-expenses-hero').evaluate((element) => element.getBoundingClientRect().height)
      assert.ok(Math.abs(expenseHeight - dashboardHeight) <= 2, `Expenses hero (${expenseHeight}px) differs from dashboard (${dashboardHeight}px) at ${width}px`)
    }

    await expect(page.getByRole('heading', { name: 'Expenses', level: 1 })).toBeVisible()
    await expect(page.locator('.page-heading')).toHaveCount(0)
    await expect(page.locator('.admin-expenses-metrics > div')).toHaveCount(4)
    await expect(page.locator('.admin-expenses-ledger .data-table tbody tr')).toHaveCount(1)
    await expect(page.locator('.admin-expenses-hero-actions').getByRole('button', { name: 'Record expense' })).toBeVisible()
    await expect(page.locator('.admin-expenses-hero-actions').getByRole('button', { name: 'Export Excel' })).toBeEnabled()

    for (const width of [1440, 1170, 1024, 900, 800, 600, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 700 : 900 })
      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector).getBoundingClientRect()
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
        }
        return {
          documentWidth: document.documentElement.scrollWidth,
          hero: rect('.admin-expenses-hero'),
          actions: rect('.admin-expenses-hero-actions'),
          filters: rect('.admin-expenses-discovery'),
          ledger: rect('.admin-expenses-ledger'),
          metrics: [...document.querySelectorAll('.admin-expenses-metrics > div')].map((element) => {
            const box = element.getBoundingClientRect()
            return { left: box.left, right: box.right }
          }),
          metricTransition: getComputedStyle(document.querySelector('.admin-expenses-metrics > div')).transitionDuration,
        }
      })
      assert.ok(layout.documentWidth <= width + 1, `Expenses page overflows at ${width}px: ${JSON.stringify(layout)}`)
      for (const box of [layout.hero, layout.actions, layout.filters, layout.ledger, ...layout.metrics])
        assert.ok(box.left >= -1 && box.right <= width + 1, `Expenses section overflows at ${width}px: ${JSON.stringify(box)}`)
      assert.ok(layout.actions.top >= layout.hero.top - 1 && layout.actions.bottom <= layout.hero.bottom + 1, `Expenses actions leave the hero at ${width}px`)
      assert.equal(layout.metricTransition, '0s', 'reduced motion removes metric transitions')
    }

    await page.getByRole('combobox', { name: 'Filter records' }).selectOption('Supplies')
    await expect(page.locator('.admin-expenses-ledger .data-table tbody tr')).toHaveCount(1)
    await page.getByRole('searchbox', { name: 'Search expenses' }).fill('unmatched item')
    await expect(page.getByText('No matching records')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeDisabled()
    await page.getByRole('button', { name: 'Reset' }).click()
    await page.getByRole('button', { name: 'Export Excel' }).click()
    await expect(page.getByRole('dialog', { name: 'Excel preview' })).toContainText('1 rows')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Record expense' }).click()
    await expect(page.getByRole('dialog', { name: 'New expense' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Edit Workshop cleaning supplies' }).click()
    await expect(page.getByRole('dialog', { name: 'Edit expense' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Audit' }).click()
    await expect(page.getByRole('dialog', { name: 'Expense audit history' })).toBeVisible()
    await page.keyboard.press('Escape')
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server.close()
  }
})
