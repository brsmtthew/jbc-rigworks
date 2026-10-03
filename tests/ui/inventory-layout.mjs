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
      await page.goto('http://127.0.0.1:5187/settings')
      await page.getByRole('button', { name: 'Reference data & taxes' }).click()
      const references = page.getByRole('dialog', { name: 'Reference data & taxes' })
      await expect(references.getByRole('button', { name: /Inventory categories/ })).toBeVisible()
      await expect(references.getByRole('button', { name: /Expense categories/ })).toBeVisible()
      await expect(references.getByRole('button', { name: /Motherboard form factors/ })).toBeVisible()
      await expect(references.getByRole('button', { name: /Power supply form factors/ })).toBeVisible()
      await references.getByRole('button', { name: /Storage interfaces/ }).click()
      const interfaces = page.getByRole('dialog', { name: 'Storage interfaces' })
      await interfaces.getByLabel('New value').fill('U.2')
      await interfaces.getByRole('button', { name: 'Add value' }).click()
      await page.getByRole('dialog', { name: 'Add directory value?' }).getByRole('button', { name: 'Add value' }).click()
      await expect(interfaces.getByText('U.2', { exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inventory' }).click()
      await page.getByRole('button', { name: 'Add item' }).click()
      const itemEditor = page.getByRole('dialog', { name: 'New inventory item' })
      const category = itemEditor.locator('select[name="category"]')
      await expect(category).toBeVisible()
      await expect(category).toHaveAttribute('required', '')
      await category.selectOption('Motherboard')
      const componentSelect = itemEditor.locator('select[name="component"]')
      await componentSelect.selectOption('Motherboard')
      await itemEditor.locator('select[name="socket"]').selectOption('AM5')
      await itemEditor.locator('select[name="memoryType"]').selectOption('DDR5')
      await itemEditor.locator('select[name="formFactor"]').selectOption('ATX')
      const storage = itemEditor.locator('.inventory-directory-multi').filter({ hasText: 'Storage interfaces' })
      await storage.locator('summary').click()
      await storage.getByRole('checkbox', { name: 'SATA', exact: true }).check()
      await storage.getByRole('checkbox', { name: 'NVMe', exact: true }).check()
      await expect(storage.getByRole('checkbox', { name: 'U.2', exact: true })).toBeVisible()
      await expect(storage.locator('input[type="hidden"]')).toHaveValue('SATA, NVMe')
      const compatibilityValues = await itemEditor.locator('#inventory-editor').evaluate((form) => {
        const values = new FormData(form)
        return Object.fromEntries(['socket', 'memoryType', 'formFactor', 'storageInterfaces'].map((key) => [key, values.get(key)]))
      })
      assert.deepEqual(compatibilityValues, {
        socket: 'AM5',
        memoryType: 'DDR5',
        formFactor: 'ATX',
        storageInterfaces: 'SATA, NVMe',
      })
      await page.setViewportSize({ width: 320, height: 700 })
      const editorWidth = await itemEditor.evaluate((dialog) => ({
        content: dialog.querySelector('.dialog-body').scrollWidth,
        visible: dialog.querySelector('.dialog-body').clientWidth,
        viewport: document.documentElement.scrollWidth,
      }))
      assert.ok(editorWidth.content <= editorWidth.visible + 1 && editorWidth.viewport <= 321, JSON.stringify(editorWidth))
      await storage.locator('summary').click()
      await componentSelect.selectOption('Storage')
      await itemEditor.locator('select[name="storageInterface"]').selectOption('U.2')
      await componentSelect.selectOption('Power supply')
      await itemEditor.locator('select[name="formFactor"]').selectOption('SFX')
      await componentSelect.selectOption('Case')
      await expect(itemEditor.locator('.inventory-directory-multi').filter({ hasText: 'Supported motherboard sizes' })).toBeVisible()
      await itemEditor.locator('details').filter({ hasText: 'Product presentation' }).locator('summary').click()
      await itemEditor.locator('details').filter({ hasText: 'Warranty overrides' }).locator('summary').click()
      await expect(itemEditor.getByLabel('Description', { exact: true })).toBeVisible()
      await expect(itemEditor.getByLabel('Specifications', { exact: true })).toBeVisible()
      await expect(itemEditor.getByLabel('Warranty (months and terms)')).toBeVisible()
      await expect(itemEditor.getByLabel('Minimum stock')).toHaveCount(0)
      await expect(itemEditor.getByLabel('Storage location')).toHaveCount(0)
      await page.keyboard.press('Escape')
      assert.deepEqual(errors, [])
    } finally {
      await browser?.close()
      await server.close()
    }
  },
)
