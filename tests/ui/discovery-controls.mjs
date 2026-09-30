import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

const cards = [
  { route: '/sales', card: '.admin-sales-discovery', heading: '.admin-sales-discovery-heading', search: '.list-toolbar .search-field', filter: '.list-toolbar select' },
  { route: '/expenses', card: '.admin-expenses-discovery', heading: '.admin-expenses-discovery-heading', search: '.list-toolbar .search-field', filter: '.list-toolbar select' },
  { route: '/inventory', card: '.inventory-discovery', heading: '.inventory-discovery-heading', search: '.inventory-filter-toolbar .search-field', filter: '.inventory-filter-toolbar select' },
  { route: '/pos', card: '.admin-pos-discovery', heading: '.admin-pos-discovery-heading', search: '.pos-toolbar .search-field', filter: '.admin-pos-type-filter' },
  { route: '/customer/services', card: '.service-catalog-tools', heading: '.service-catalog-heading', search: '.service-search-field', filter: '.service-device-filter .record-tabs' },
]

test('search cards keep counts, labels, and controls in a consistent responsive layout', { timeout: 120000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    await page.route(/\.(?:png|jpe?g|webp|gif|avif)(?:\?|$)/i, (route) => route.abort())
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      for (const config of cards) {
        await page.goto(`http://127.0.0.1:5187${config.route}`)
        await expect(page.locator(config.card)).toBeVisible()
        const layout = await page.evaluate(({ card, heading, search, filter }) => {
          const bounds = (selector) => {
            const rect = document.querySelector(`${card} ${selector}`).getBoundingClientRect()
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
          }
          const element = document.querySelector(card)
          const rect = element.getBoundingClientRect()
          const count = element.querySelector('.discovery-card-count').getBoundingClientRect()
          return {
            card: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
            heading: bounds(heading), search: bounds(search), filter: bounds(filter),
            count: { left: count.left, right: count.right, top: count.top, bottom: count.bottom },
            scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
          }
        }, config)
        assert.ok(layout.scrollWidth <= layout.clientWidth + 1, `${config.route} card scrolls at ${width}px: ${JSON.stringify(layout)}`)
        for (const part of [layout.heading, layout.search, layout.filter, layout.count])
          assert.ok(part.left >= layout.card.left - 1 && part.right <= layout.card.right + 1, `${config.route} control leaves card at ${width}px: ${JSON.stringify(part)}`)
        assert.ok(layout.heading.bottom <= Math.min(layout.search.top, layout.filter.top) + 1, `${config.route} heading overlaps controls at ${width}px`)
        if (width >= 1024)
          assert.ok(Math.abs(layout.search.top - layout.filter.top) <= 2, `${config.route} controls are not aligned at ${width}px: ${JSON.stringify(layout)}`)
        if (width === 320 && config.route === '/expenses') {
          await page.locator('.admin-expense-more-filters summary').click()
          const expanded = await page.locator(config.card).evaluate((card) => ({
            scrollWidth: card.scrollWidth,
            clientWidth: card.clientWidth,
            controlsFit: [...card.querySelectorAll('.admin-expense-filters input, .admin-expense-filters select')]
              .every((control) => {
                const box = control.getBoundingClientRect()
                const cardBox = card.getBoundingClientRect()
                return box.left >= cardBox.left - 1 && box.right <= cardBox.right + 1
              }),
          }))
          assert.ok(expanded.scrollWidth <= expanded.clientWidth + 1 && expanded.controlsFit, `Expanded expense filters overflow: ${JSON.stringify(expanded)}`)
        }
      }
    }
  } finally {
    await browser?.close()
    await server.close()
  }
})
