import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test(
  'admin navigation, keyboard focus, and preserved 3D controls',
  { timeout: 90000 },
  async () => {
    const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
    await server.listen()
    let browser
    try {
      browser = await chromium.launch({ channel: 'msedge', headless: true })
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      })
      await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
      await mkdir('test-results/ui', { recursive: true })
      await page.goto('http://127.0.0.1:5187/dashboard')
      await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
      await expect(page.locator('.app-sidebar')).toHaveCSS('width', '78px')
      await page.setViewportSize({ width: 390, height: 844 })
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
      const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true })
      await expect(
        drawer.getByRole('link', { name: 'Inventory', exact: true }).locator('span'),
      ).toBeVisible()
      await drawer.getByRole('link', { name: 'Inventory', exact: true }).click()
      await expect(drawer).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible()
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click()
      await page.getByRole('link', { name: 'PC Builds', exact: true }).click()
      await page.getByRole('button', { name: 'Builder tool', exact: true }).click()
      const canvas = page.locator('.pc-3d-builder canvas')
      await expect(canvas).toBeVisible()
      await canvas.evaluate((el) => {
        el.dataset.preservationCheck = 'original'
      })
      for (const name of ['Zoom in', 'Zoom out', 'Reset camera'])
        await page.getByRole('button', { name, exact: true }).click()
      for (const name of ['Auto rotate', 'Show side panel', 'Exploded view']) {
        const control = page.getByRole('button', { name, exact: true })
        await control.click()
        await expect(control).toHaveAttribute('aria-pressed', 'true')
        await control.click()
        await expect(control).toHaveAttribute('aria-pressed', 'false')
      }
      const labels = page.getByRole('button', { name: 'Show part labels', exact: true })
      await labels.click()
      await expect(labels).toHaveAttribute('aria-pressed', 'false')
      await labels.click()
      await expect(labels).toHaveAttribute('aria-pressed', 'true')
      await expect(canvas).toHaveAttribute('data-preservation-check', 'original')
      await page.getByRole('button', { name: 'Reset camera', exact: true }).click()
      await page.screenshot({ path: 'test-results/ui/admin-3d-controls.png' })

      await page.goto('http://127.0.0.1:5187/inventory')
      await page.getByRole('button', { name: 'Scan inventory QR', exact: true }).click()
      const scanner = page.getByRole('dialog', { name: 'Inventory QR tracking' })
      await scanner.getByRole('textbox', { name: 'QR code or SKU', exact: true }).fill('JBC-0')
      await scanner.getByRole('button', { name: 'Find inventory item', exact: true }).click()
      await expect(scanner.getByRole('img', { name: /Inventory QR label/ })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('button', { name: 'Scan inventory QR', exact: true }),
      ).toBeFocused()

      const fallback = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      })
      await fallback.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
      await fallback.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
          return getContext.call(this, type, ...args)
        }
      })
      await fallback.goto('http://127.0.0.1:5187/pc-building')
      await fallback.getByRole('button', { name: 'Builder tool', exact: true }).click()
      await expect(fallback.getByText(/3D preview unavailable in this browser/)).toBeVisible()
      assert.equal(await fallback.locator('h1').count(), 1)
      await fallback.screenshot({ path: 'test-results/ui/admin-3d-fallback.png' })
    } finally {
      await browser?.close()
      await server.close()
    }
  },
)
