import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('admin PC builds requests, quotes, and builder tab fit responsive layouts', { timeout: 90000 }, async () => {
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
    await page.goto('http://127.0.0.1:5187/pc-building')
    await expect(page.getByRole('heading', { name: 'PC Builds', level: 1 })).toBeVisible()
    await expect(page.locator('.admin-builds-hero.jbc-blue-hero')).toBeVisible()
    await expect(page.locator('.admin-builds-hero-icon')).toHaveCount(0)
    await expect(page.locator('.page-heading')).toHaveCount(0)
    await expect(page.locator('.admin-build-request-row')).toHaveCount(1)

    for (const width of [1440, 1170, 1024, 900, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector).getBoundingClientRect()
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
        }
        return {
          documentWidth: document.documentElement.scrollWidth,
          hero: rect('.admin-builds-hero'),
          tabs: rect('.admin-builds-tabs'),
          controls: rect('.admin-build-queue-controls'),
          row: rect('.admin-build-request-row'),
          main: rect('.admin-build-request-main'),
          actions: rect('.admin-build-request-actions'),
          transition: getComputedStyle(document.querySelector('.admin-build-request-row')).transitionDuration,
        }
      })
      assert.ok(layout.documentWidth <= width + 1, `PC Builds overflows at ${width}px: ${JSON.stringify(layout)}`)
      for (const key of ['hero', 'tabs', 'controls', 'row', 'main', 'actions'])
        assert.ok(layout[key].left >= -1 && layout[key].right <= width + 1, `${key} overflows at ${width}px`)
      assert.ok(layout.tabs.top >= layout.hero.bottom - 1, `Requests toggle appears above the hero at ${width}px`)
      if (width > 900)
        assert.ok(layout.actions.left >= layout.main.right - 1, `Actions are not beside the row at ${width}px`)
      else
        assert.ok(layout.actions.top >= layout.main.bottom - 1, `Actions are not below the row at ${width}px`)
      assert.equal(layout.transition, '0s', 'reduced motion removes row transitions')
    }

    await page.getByRole('searchbox', { name: 'Search build requests' }).fill('missing build')
    await expect(page.getByText('No builds match your filters')).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search build requests' }).fill('Jamie')
    await expect(page.locator('.admin-build-request-row')).toHaveCount(1)
    await page.getByRole('button', { name: 'Quotes & approval' }).click()
    await expect(page.locator('.admin-build-request-row')).toHaveCount(0)
    await page.getByRole('button', { name: 'Needs review' }).click()
    await expect(page.locator('.admin-build-request-row')).toHaveCount(1)
    await page.getByRole('button', { name: 'All requests' }).click()
    await page.getByRole('button', { name: 'View components' }).click()
    const review = page.getByRole('dialog', { name: 'Review PC build' })
    await expect(review.getByText('Submitted components')).toBeVisible()
    await expect(review.getByText('COMPATIBILITY REVIEW')).toBeVisible()
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 760 })
      const layout = await page.evaluate(() => {
        const box = document.querySelector('.app-dialog:has(.admin-build-review)').getBoundingClientRect()
        return { documentWidth: document.documentElement.scrollWidth, left: box.left, right: box.right, bottom: box.bottom }
      })
      assert.ok(layout.documentWidth <= width + 1 && layout.left >= -1 && layout.right <= width + 1 && layout.bottom <= 761, `Review dialog overflows at ${width}px`)
    }
    await page.keyboard.press('Escape')

    await page.evaluate(async () => {
      const { collections } = await import('/tests/ui/fixtures/data.ts')
      collections.pcRequests[0].status = 'Under review'
    })
    await page.getByRole('button', { name: 'Builder tool' }).click()
    await expect(page.locator('.pc-builder-redesign')).toBeVisible()
    await expect(page.locator('.pc-3d-builder')).toBeVisible()
    await expect(page.locator('.admin-builds-page > .pcb-hero')).toBeVisible()
    await expect(page.locator('.pc-builder-redesign > .pcb-hero')).toHaveCount(0)
    await expect(page.locator('.admin-build-request-list')).toHaveCount(0)
    assert.equal(await page.locator('h1').count(), 1)
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      const layout = await page.evaluate(() => {
        const hero = document.querySelector('.admin-builds-page > .pcb-hero').getBoundingClientRect()
        const tabs = document.querySelector('.admin-builds-tabs').getBoundingClientRect()
        const tool = document.querySelector('.pc-builder-redesign').getBoundingClientRect()
        return { documentWidth: document.documentElement.scrollWidth, heroBottom: hero.bottom, tabsTop: tabs.top, tabsBottom: tabs.bottom, toolTop: tool.top }
      })
      assert.ok(layout.documentWidth <= width + 1, `Builder tab overflows at ${width}px`)
      assert.ok(layout.tabsTop >= layout.heroBottom - 1, `Builder toggle appears above the hero at ${width}px`)
      assert.ok(layout.toolTop >= layout.tabsBottom - 1, `Builder content appears above the toggle at ${width}px`)
    }
    await page.getByRole('button', { name: 'Requests & quotes' }).click()
    await page.getByRole('button', { name: 'View components' }).click()
    await expect(review.getByRole('button', { name: 'Prepare final quote' })).toBeEnabled()
    await review.getByRole('button', { name: 'Prepare final quote' }).click()
    const quote = page.getByRole('dialog', { name: 'Prepare final quote' })
    await expect(quote.getByText('FINAL QUOTATION')).toBeVisible()
    await expect(quote.getByLabel('Final quote (PHP)')).toBeVisible()
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 760 })
      const layout = await page.evaluate(() => {
        const box = document.querySelector('.app-dialog:has(.admin-build-dialog-form)').getBoundingClientRect()
        return { documentWidth: document.documentElement.scrollWidth, left: box.left, right: box.right, bottom: box.bottom }
      })
      assert.ok(layout.documentWidth <= width + 1 && layout.left >= -1 && layout.right <= width + 1 && layout.bottom <= 761, `Quote dialog overflows at ${width}px`)
    }
    await page.keyboard.press('Escape')
    await page.evaluate(async () => {
      const { collections } = await import('/tests/ui/fixtures/data.ts')
      collections.pcRequests[0].status = 'Quoted'
      collections.pcRequests[0].quote = {
        amount: 48999,
        message: 'Parts and assembly included',
        createdAt: '2026-09-29T10:00:00.000Z',
      }
    })
    await page.getByRole('button', { name: 'Builder tool' }).click()
    await page.getByRole('button', { name: 'Requests & quotes' }).click()
    await page.getByRole('button', { name: 'Record approval' }).click()
    const approval = page.getByRole('dialog', { name: 'Record customer approval' })
    await expect(approval.getByText('CUSTOMER APPROVAL', { exact: true })).toBeVisible()
    await expect(approval.getByLabel('Approval evidence / conversation reference')).toBeVisible()
    await page.keyboard.press('Escape')
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server.close()
  }
})
