import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('dropdown controls share a visual style across inventory and customer pages', { timeout: 90000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    await page.route(/\.(?:png|jpe?g|webp|gif|avif)(?:\?|$)/i, (route) => route.abort())
    const style = (locator) => locator.evaluate((element) => {
      const css = getComputedStyle(element)
      return {
        border: css.borderTopColor,
        radius: css.borderTopLeftRadius,
        background: css.backgroundColor,
        color: css.color,
      }
    })

    await page.goto('http://127.0.0.1:5187/inventory')
    const filter = page.locator('.inventory-category-filter select').first()
    await expect(filter).toBeVisible()
    const expected = await style(filter)
    const selectDecoration = await filter.evaluate((element) => {
      const css = getComputedStyle(element)
      return { appearance: css.appearance, chevron: css.backgroundImage }
    })
    assert.equal(selectDecoration.appearance, 'none')
    assert.match(selectDecoration.chevron, /data:image\/svg\+xml/)

    await page.getByRole('button', { name: 'Add item' }).click()
    const editor = page.getByRole('dialog', { name: 'New inventory item' })
    await editor.locator('select[name="component"]').selectOption('Motherboard')
    assert.deepEqual(await style(editor.locator('select[name="socket"]')), expected)
    const multi = editor.locator('.inventory-directory-multi summary').first()
    assert.deepEqual(await style(multi), expected)
    assert.equal(await multi.evaluate((element) => getComputedStyle(element, '::after').backgroundImage), selectDecoration.chevron)
    await page.setViewportSize({ width: 320, height: 700 })
    await multi.click()
    const menuFits = await editor.evaluate((dialog) => {
      const body = dialog.querySelector('.dialog-body')
      const menu = dialog.querySelector('.inventory-directory-options').getBoundingClientRect()
      return body.scrollWidth <= body.clientWidth + 1 && menu.left >= -1 && menu.right <= innerWidth + 1
    })
    assert.ok(menuFits, 'the multi-choice menu fits in the small inventory dialog')

    await page.goto('http://127.0.0.1:5187/customer/records')
    const customerSelect = page.locator('.record-filters select').first()
    await expect(customerSelect).toBeVisible()
    assert.deepEqual(await style(customerSelect), expected)
    assert.equal(await customerSelect.evaluate((element) => getComputedStyle(element).appearance), 'none')
  } finally {
    await browser?.close()
    await server.close()
  }
})
