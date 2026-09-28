import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('loading states and booking intro fit without overflow or forced motion', { timeout: 90000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 568 : 700 })
      for (const variant of ['screen', 'cards', 'table', 'compact']) {
        await page.goto(`http://127.0.0.1:5187/tests/ui/fixtures/loading.html?variant=${variant}`)
        const state = page.getByRole('status', { name: 'Loading your activity…' })
        await expect(state).toBeVisible()
        await expect(state).toHaveAttribute('aria-busy', 'true')
        const layout = await page.evaluate(() => ({
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          loader: document.querySelector('.loading-state')?.scrollWidth,
          loaderWidth: document.querySelector('.loading-state')?.clientWidth,
          animation: getComputedStyle(document.querySelector('.loading-state__track span')).animationName,
        }))
        assert.ok(layout.document <= width + 1, `${variant} page overflows at ${width}: ${JSON.stringify(layout)}`)
        assert.ok(layout.loader <= layout.loaderWidth + 1, `${variant} loader overflows at ${width}: ${JSON.stringify(layout)}`)
        assert.equal(layout.animation, 'none', 'reduced motion stops progress animation')
        if (variant === 'screen') {
          await expect(page.locator('.loading-state__logo img')).toHaveJSProperty('complete', true)
          const splash = await page.evaluate(() => ({
            height: document.documentElement.scrollHeight,
            viewport: innerHeight,
            logoLoaded: document.querySelector('.loading-state__logo img')?.naturalWidth > 0,
          }))
          assert.ok(splash.height <= splash.viewport + 1, `screen scrolls at ${width}: ${JSON.stringify(splash)}`)
          assert.ok(splash.logoLoaded, 'brand logo loads on the opening screen')
        }
      }
      await page.goto('http://127.0.0.1:5187/customer/services')
      await expect(page.locator('.booking-intro-note')).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Choose the care your device needs.' })).toBeVisible()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    }
  } finally {
    await browser?.close()
    await server.close()
  }
})
