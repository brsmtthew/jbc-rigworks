import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

const routes = [
  '/dashboard', '/pos', '/jobs', '/pc-building', '/inventory',
  '/sales', '/expenses', '/reports', '/settings',
  '/customer', '/customer/shop', '/customer/services',
  '/customer/pc-building', '/customer/records',
]

test('customer and admin pages expose named controls and fit narrow screens', { timeout: 120000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    await page.route(/\.(?:png|jpe?g|webp|gif|avif)(?:\?|$)/i, (route) => route.abort())
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const route of routes) {
        await page.goto(`http://127.0.0.1:5187${route}`)
        await expect(page.locator('.page-transition')).toBeVisible()
        const audit = await page.evaluate(() => {
          const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
          const unnamed = [...document.querySelectorAll('button, a[href], input, select, textarea')]
            .filter(visible)
            .filter((element) => {
              if (element instanceof HTMLInputElement && ['hidden', 'submit'].includes(element.type)) return false
              const named = element.getAttribute('aria-label')?.trim()
                || element.getAttribute('title')?.trim()
                || element.getAttribute('aria-labelledby')?.trim()
                || element.labels?.[0]?.textContent?.trim()
                || element.textContent?.trim()
              return !named
            })
            .map((element) => element.outerHTML.slice(0, 180))
          return { width: document.documentElement.scrollWidth, unnamed }
        })
        assert.ok(audit.width <= width + 1, `${route} overflows at ${width}px: ${audit.width}`)
        assert.deepEqual(audit.unnamed, [], `${route} has unnamed controls at ${width}px`)
        if (route === '/dashboard' && width === 1440) {
          const nav = page.getByRole('navigation', { name: 'Main navigation' })
          const active = nav.locator('.nav-item.is-active').first()
          const inactive = nav.locator('.nav-item:not(.is-active)').first()
          const activeBackground = await active.evaluate((element) => getComputedStyle(element).backgroundColor)
          const idleBackground = await inactive.evaluate((element) => getComputedStyle(element).backgroundColor)
          assert.notEqual(activeBackground, idleBackground, 'active navigation must stand out')
          await inactive.hover()
          await expect(inactive).not.toHaveCSS('background-color', idleBackground)
          await page.keyboard.press('Tab')
          const outline = await page.locator(':focus').evaluate((element) => getComputedStyle(element).outlineWidth)
          assert.equal(outline, '3px', 'keyboard focus is not visible in the admin workspace')
        }
      }
    }
  } finally {
    await browser?.close()
    await server.close()
  }
})
