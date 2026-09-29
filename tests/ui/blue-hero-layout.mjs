import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

const pages = [
  '/dashboard',
  '/pos',
  '/jobs',
  '/pc-building',
  '/customer',
  '/customer/shop',
  '/customer/services',
  '/customer/pc-building',
  '/customer/records',
]

test(
  'large blue page cards share the dashboard typography and POS actions sit right',
  { timeout: 90000 },
  async () => {
    const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
    await server.listen()
    let browser
    try {
      browser = await chromium.launch({ channel: 'msedge', headless: true })
      const page = await browser.newPage({ reducedMotion: 'reduce' })
      await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
      await page.route(/\.(?:png|jpe?g|webp|gif|avif)(?:\?|$)/i, (route) => route.abort())

      for (const width of [1440, 1170, 1024, 390]) {
        await page.setViewportSize({ width, height: 900 })
        let dashboardStyle
        for (const path of pages) {
          await page.goto(`http://127.0.0.1:5187${path}`)
          await expect(page.locator('.jbc-blue-hero')).toBeVisible()
          const result = await page.evaluate(() => {
            const hero = document.querySelector('.jbc-blue-hero')
            const heading = hero.querySelector('h1, h2')
            const kicker = heading.previousElementSibling
            const description = hero.querySelector('p')
            const heroStyle = getComputedStyle(hero)
            const headingStyle = getComputedStyle(heading)
            const kickerStyle = getComputedStyle(kicker)
            const descriptionStyle = getComputedStyle(description)
            const copy = hero.querySelector('.admin-pos-overview-copy')?.getBoundingClientRect()
            const actions = hero.querySelector('.admin-pos-overview-actions')?.getBoundingClientRect()
            return {
              documentWidth: document.documentElement.scrollWidth,
              style: {
                minHeight: heroStyle.minHeight,
                paddingTop: heroStyle.paddingTop,
                borderRadius: heroStyle.borderRadius,
                backgroundImage: heroStyle.backgroundImage,
                headingFont: headingStyle.fontFamily,
                headingSize: headingStyle.fontSize,
                headingWeight: headingStyle.fontWeight,
                kickerSize: kickerStyle.fontSize,
                kickerWeight: kickerStyle.fontWeight,
                descriptionSize: descriptionStyle.fontSize,
              },
              pos: copy && actions ? { copyRight: copy.right, actionsLeft: actions.left } : null,
            }
          })
          assert.ok(result.documentWidth <= width + 1, `${path} overflows at ${width}px`)
          if (path === '/dashboard') dashboardStyle = result.style
          else
            assert.deepEqual(
              result.style,
              dashboardStyle,
              `${path} hero differs from dashboard at ${width}px`,
            )
          if (path === '/pos' && width >= 1024)
            assert.ok(
              result.pos.actionsLeft > result.pos.copyRight,
              `POS actions are not right of the title at ${width}px`,
            )
        }
      }
    } finally {
      await browser?.close()
      await server.close()
    }
  },
)
