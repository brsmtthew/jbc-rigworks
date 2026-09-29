import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test(
  'inventory hero, controls, and records fit without image capture',
  { timeout: 120000 },
  async () => {
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

      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('http://127.0.0.1:5187/dashboard')
      const dashboardHeroHeight = await page
        .locator('.admin-dashboard-hero')
        .evaluate((hero) => Math.round(hero.getBoundingClientRect().height))
    for (const width of [1440, 1024, 800, 700, 520, 390, 360, 320]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('http://127.0.0.1:5187/inventory')
        await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible()
        await expect(page.locator('.inventory-metrics > div')).toHaveCount(4)
        const layout = await page.evaluate(() => {
          const hero = document.querySelector('.inventory-hero').getBoundingClientRect()
          const glass = document.querySelector('.inventory-hero-actions').getBoundingClientRect()
          const actions = [...document.querySelectorAll('.inventory-hero-actions button')]
          const rows = [...document.querySelectorAll('.inventory-row-actions')]
          return {
            documentFits: document.documentElement.scrollWidth <= innerWidth + 1,
            heroHeight: Math.round(hero.height),
            glassFits: glass.left >= hero.left - 1 && glass.right <= hero.right + 1,
            actionsFit: actions.every((button) => {
              const bounds = button.getBoundingClientRect()
              return bounds.left >= glass.left - 1 && bounds.right <= glass.right + 1
            }),
            rowsFit: rows.every((row) => {
              const bounds = row.getBoundingClientRect()
              return [...row.querySelectorAll('button')].every((button) => {
                const rect = button.getBoundingClientRect()
                return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
              })
            }),
            controlsFit: [...document.querySelectorAll('.inventory-filter-toolbar > *')].every(
              (element) => {
                const rect = element.getBoundingClientRect()
                const parent = element.parentElement.getBoundingClientRect()
                return rect.left >= parent.left - 1 && rect.right <= parent.right + 1
              },
            ),
          }
        })
        assert.ok(
          layout.documentFits &&
            layout.glassFits &&
            layout.actionsFit &&
            layout.rowsFit &&
            layout.controlsFit,
          `${width}px: ${JSON.stringify(layout)}`,
        )
        if (width === 1440)
          assert.ok(
            Math.abs(layout.heroHeight - dashboardHeroHeight) <= 2,
            `Inventory hero ${layout.heroHeight}px, dashboard ${dashboardHeroHeight}px`,
          )
      }

      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('http://127.0.0.1:5187/inventory')
      await page.getByLabel('Filter by stock status').selectOption('out')
      await expect(page.locator('.inventory-discovery-count')).toContainText('1 item shown')
      await page.getByRole('button', { name: 'Clear filters' }).click()
      await expect(page.locator('.inventory-discovery-count')).toContainText('9 items shown')
      await page.getByRole('button', { name: 'Adjust stock for AMD Ryzen 7 7700' }).click()
      await expect(page.getByRole('dialog', { name: 'Adjust stock' })).toBeVisible()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Scan inventory QR' }).click()
      await expect(page.getByRole('dialog', { name: 'Inventory QR tracking' })).toBeVisible()
      await page.keyboard.press('Escape')
      assert.deepEqual(errors, [])
    } finally {
      await browser?.close()
      await server.close()
    }
  },
)
