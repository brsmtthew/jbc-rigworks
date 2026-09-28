import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test(
  'customer pages fit and controls work without image capture',
  { timeout: 180000 },
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
      const routes = [
        ['/customer', '.customer-home-hero'],
        ['/customer/shop', '.shop-hero'],
        ['/customer/services', '.booking-intro'],
        ['/customer/pc-building', '.pcb-hero'],
        ['/customer/records', '.customer-records-hero'],
      ]
      for (const width of [1440, 1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 })
        const heights = {}
        for (const [path, selector] of routes) {
          await page.goto(`http://127.0.0.1:5187${path}`)
          await expect(page.locator(selector)).toBeVisible()
          console.log(`checking ${path} at ${width}px`)
          await expect(page.locator('.page-content :is(h1, h2)').first()).toBeVisible()
          const metrics = await page.evaluate((heroSelector) => {
            const main = document.querySelector('.page-content')
            const hero = document.querySelector(heroSelector)
            return {
              documentWidth: document.documentElement.scrollWidth,
              mainWidth: main.scrollWidth,
              mainClient: main.clientWidth,
              heroHeight: Math.round(hero.getBoundingClientRect().height),
              overflowing: [...main.querySelectorAll('*')]
                .filter(
                  (el) => el.getBoundingClientRect().right > main.getBoundingClientRect().right + 1,
                )
                .slice(0, 4)
                .map(
                  (el) =>
                    `${el.tagName.toLowerCase()}.${String(el.className).split(' ').join('.')}`,
                ),
            }
          }, selector)
          assert.ok(
            metrics.documentWidth <= width + 1,
            `${path} document overflow at ${width}: ${JSON.stringify(metrics)}`,
          )
          assert.ok(
            metrics.mainWidth <= metrics.mainClient + 1,
            `${path} content overflow at ${width}: ${JSON.stringify(metrics)}`,
          )
          heights[path] = metrics.heroHeight
          if (path === '/customer/shop') {
            await expect(page.locator('.shop-filter-details')).not.toHaveAttribute('open', '')
            await page.locator('.shop-filter-details summary').click()
            await expect(page.locator('.shop-filter-details')).toHaveAttribute('open', '')
            await expect(page.getByLabel('Availability')).toBeVisible()
            await page.locator('.shop-filter-details summary').click()
            await expect(page.locator('.shop-filter-details')).not.toHaveAttribute('open', '')
            const details = page.getByRole('button', { name: /View specs for/ }).first()
            if (await details.count()) {
              await details.click()
              await expect(page.getByRole('dialog')).toBeVisible()
              const dialogFits = await page
                .getByRole('dialog')
                .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1)
              assert.ok(dialogFits, `Shop product dialog overflow at ${width}`)
              await page.keyboard.press('Escape')
            }
            await page
              .getByRole('button', { name: width > 1060 ? 'View cart' : /^Cart \(/ })
              .click()
            const cartDialog = page.getByRole('dialog', { name: 'Your cart' })
            await expect(cartDialog).toBeVisible()
            assert.ok(
              await cartDialog.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
              `Cart dialog overflow at ${width}`,
            )
            await page.keyboard.press('Escape')
          }
          if (path === '/customer/services' && width === 390) {
            const choose = page.getByRole('button', { name: 'Choose service' }).first()
            if ((await choose.count()) && (await choose.isEnabled())) {
              await choose.click()
              const bookingDialog = page.getByRole('dialog')
              await expect(bookingDialog).toBeVisible()
              assert.ok(
                await bookingDialog.evaluate(
                  (dialog) => dialog.scrollWidth <= dialog.clientWidth + 1,
                ),
                'Booking dialog overflows at 390px',
              )
              await page.keyboard.press('Escape')
            }
          }
          if (path === '/customer/records') {
            await page.getByRole('button', { name: /^Appointments/ }).click()
            await expect(page.getByRole('heading', { name: 'Appointment requests' })).toBeVisible()
            await page.getByRole('button', { name: /^PC requests/ }).click()
            await expect(page.getByRole('heading', { name: 'Custom build requests' })).toBeVisible()
          }
        }
        for (const [path] of routes.slice(1))
          assert.ok(
            Math.abs(heights[path] - heights['/customer']) <= 15,
            `${path} hero size differs at ${width}: ${JSON.stringify(heights)}`,
          )
        console.log(`${width}px hero heights: ${JSON.stringify(heights)}`)
      }
      assert.deepEqual(errors, [])
    } finally {
      await browser?.close()
      await server.close()
    }
  },
)
