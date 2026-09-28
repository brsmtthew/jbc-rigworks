import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('booking intake fits on small and large screens for workshop and home service', { timeout: 120000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      for (const mode of ['Workshop', 'Home service']) {
        await page.goto('http://127.0.0.1:5187/customer/services')
        await expect(page.getByText('DEVICE CARE, MADE SIMPLE')).toHaveCount(0)
        await page.getByRole('button', { name: 'Choose service', exact: true }).first().click()
        const dialog = page.getByRole('dialog')
        await dialog.getByRole('button', { name: mode === 'Workshop' ? /Workshop Bring/ : /Home service JBC visits/ }).click()
        await dialog.getByLabel('Device brand / model').fill('Lenovo ThinkPad')
        await dialog.getByRole('button', { name: 'Continue' }).click()
        const date = dialog.locator('input[type=date]')
        let hasTime = false
        for (let day = 8; day < 25 && !hasTime; day++) {
          const next = new Date(Date.now() + day * 86400000).toISOString().slice(0, 10)
          await date.fill(next)
          hasTime = await dialog.locator('select option').count() > 1
        }
        assert.ok(hasTime, 'an appointment window is available')
        await dialog.locator('select').selectOption({ index: 1 })
        await dialog.getByRole('button', { name: 'Continue' }).click()
        await expect(dialog.getByRole('heading', { name: 'Tell us about your device' })).toBeVisible()
        await expect(dialog.locator('.booking-steps li')).toHaveCount(4)
        const sizes = await page.evaluate(() => ({
          viewport: innerWidth,
          page: document.documentElement.scrollWidth,
          body: document.querySelector('dialog .dialog-body')?.scrollWidth,
          bodyWidth: document.querySelector('dialog .dialog-body')?.clientWidth,
        }))
        assert.ok(sizes.page <= sizes.viewport + 1, `${mode} page overflows at ${width}: ${JSON.stringify(sizes)}`)
        assert.ok(sizes.body <= sizes.bodyWidth + 1, `${mode} intake overflows at ${width}: ${JSON.stringify(sizes)}`)
        await expect(dialog.locator('.dialog-footer')).toBeInViewport()
        await dialog.getByLabel('Describe visible condition or wear').fill('Small scratch on lid')
        await dialog.getByLabel('Existing hardware or performance issues').fill('Fan noise')
        await dialog.getByLabel('Condition and issue history').fill('Started last month')
        await dialog.getByLabel(/I understand the printed intake/).check()
        await dialog.getByRole('button', { name: 'Continue' }).click()
        await expect(dialog.getByRole('heading', { name: 'Review your request' })).toBeVisible()
      }
    }
    await page.setViewportSize({ width: 794, height: 1123 })
    await page.goto('http://127.0.0.1:5187/tests/ui/fixtures/intake-print.html')
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { name: 'Customer intake & service authorization' })).toBeVisible()
    const print = await page.evaluate(() => ({
      rootVisible: getComputedStyle(document.querySelector('.home-intake-print-root')).display,
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      signatures: document.querySelectorAll('.home-intake-signatures > div').length,
    }))
    assert.equal(print.rootVisible, 'block')
    assert.equal(print.signatures, 2)
    assert.ok(print.width <= print.viewport + 1, `print form overflows: ${JSON.stringify(print)}`)
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server.close()
  }
})
