import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('notification actions open the matching record and persist read or deleted state', { timeout: 60000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    await page.route(/\.(?:png|jpe?g|webp|gif|avif)(?:\?|$)/i, (route) => route.abort())
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://127.0.0.1:5187/dashboard')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav.locator('.admin-nav-badge')).toHaveCount(0)
    const button = page.getByRole('button', { name: /Notifications, 3 unread/ })
    await expect(button).toBeVisible()
    await button.click()
    const center = page.getByRole('dialog', { name: 'Notification center' })
    await expect(center.locator('.admin-notification-item')).toHaveCount(3)
    await center.getByRole('button', { name: 'Mark Service booking request as read' }).click()
    await expect(page.getByRole('button', { name: /Notifications, 2 unread/ })).toBeVisible()
    await center.getByRole('button', { name: 'Mark all as read' }).click()
    await expect(page.getByRole('button', { name: /Notifications, 0 unread/ })).toBeVisible()
    await center.getByRole('link', { name: 'View New online order' }).click()
    await expect(page).toHaveURL(/\/pos\?orders=true&reference=/)
    await expect(page.getByRole('dialog', { name: 'Online orders' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /Notifications, 0 unread/ }).click()
    await center.getByRole('button', { name: 'Delete New online order notification' }).click()
    await expect(center.locator('.admin-notification-item')).toHaveCount(2)
    await page.goto('http://127.0.0.1:5187/dashboard')
    await page.reload()
    await page.getByRole('button', { name: /Notifications, 0 unread/ }).click()
    await expect(center.locator('.admin-notification-item')).toHaveCount(2)
    await center.getByRole('link', { name: 'View Service booking request' }).click()
    await expect(page).toHaveURL(/\/jobs\?reference=APT-fixture$/)
    await expect(page.getByRole('searchbox', { name: 'Search appointments' })).toHaveValue('APT-fixture')
    await expect(page.locator('.service-record-row')).toHaveCount(1)
    await page.getByRole('button', { name: /Notifications, 0 unread/ }).click()
    await center.getByRole('link', { name: 'View PC build request' }).click()
    await expect(page).toHaveURL(/\/pc-building\?reference=PC-fixture$/)
    await expect(page.getByRole('searchbox', { name: 'Search build requests' })).toHaveValue('PC-fixture')
    await expect(page.locator('.admin-build-request-row')).toHaveCount(1)
    for (const width of [600, 390, 320]) {
      await page.keyboard.press('Escape')
      await page.setViewportSize({ width, height: 700 })
      await page.getByRole('button', { name: /Notifications, 0 unread/ }).click()
      const fit = await page.getByRole('dialog', { name: 'Notification center' }).evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }
      })
      assert.ok(fit.left >= -1 && fit.right <= width + 1 && fit.scrollWidth <= fit.clientWidth + 1)
      await page.keyboard.press('Escape')
    }
  } finally {
    await browser?.close()
    await server.close()
  }
})
