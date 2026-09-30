import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('admin website settings and account modal fit responsive layouts', { timeout: 90000 }, async () => {
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

    for (const width of [1440, 1170, 1024]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('http://127.0.0.1:5187/dashboard')
      const dashboardHeight = await page.locator('.admin-dashboard-hero').evaluate((element) => element.getBoundingClientRect().height)
      await page.goto('http://127.0.0.1:5187/settings')
      const settingsHeight = await page.locator('.admin-settings-hero').evaluate((element) => element.getBoundingClientRect().height)
      assert.ok(Math.abs(settingsHeight - dashboardHeight) <= 2, `Settings hero (${settingsHeight}px) differs from dashboard (${dashboardHeight}px) at ${width}px`)
    }

    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    await expect(page.locator('.page-heading')).toHaveCount(0)
    await expect(page.locator('.admin-site-settings .profile-card')).toHaveCount(0)
    await expect(page.locator('.admin-site-settings-tile')).toHaveCount(4)
    await expect(page.locator('.admin-settings-hero-actions').getByRole('button')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Profile settings' })).toBeVisible()
    await page.getByRole('button', { name: 'Clear all data', exact: true }).click()
    const clearDialog = page.getByRole('dialog', { name: 'Clear all website data' })
    await expect(clearDialog.getByRole('button', { name: 'Permanently clear data' })).toBeDisabled()
    await clearDialog.getByLabel('Type DELETE ALL DATA to confirm').fill('DELETE ALL DATA')
    await expect(clearDialog.getByRole('button', { name: 'Permanently clear data' })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(clearDialog).toHaveCount(0)

    for (const width of [1440, 1170, 1024, 900, 800, 600, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 700 : 900 })
      const layout = await page.evaluate(() => {
        const box = (selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect()
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
        }
        const actions = document.querySelector('.admin-settings-hero-actions')
        return {
          documentWidth: document.documentElement.scrollWidth,
          hero: box('.admin-settings-hero'),
          actions: box('.admin-settings-hero-actions'),
          section: box('.admin-site-settings-section'),
          tiles: [...document.querySelectorAll('.admin-site-settings-tile')].map((tile) => {
            const rect = tile.getBoundingClientRect()
            return { left: rect.left, right: rect.right }
          }),
          actionsClipped: actions.scrollWidth > actions.clientWidth + 1,
          tileTransition: getComputedStyle(document.querySelector('.admin-site-settings-tile')).transitionDuration,
        }
      })
      assert.ok(layout.documentWidth <= width + 1, `Settings page overflows at ${width}px: ${JSON.stringify(layout)}`)
      assert.equal(layout.actionsClipped, false, `Settings actions are clipped at ${width}px`)
      for (const rect of [layout.hero, layout.actions, layout.section, ...layout.tiles])
        assert.ok(rect.left >= -1 && rect.right <= width + 1, `Settings section overflows at ${width}px: ${JSON.stringify(rect)}`)
      assert.ok(layout.actions.top >= layout.hero.top - 1 && layout.actions.bottom <= layout.hero.bottom + 1, `Settings actions leave the hero at ${width}px`)
      assert.equal(layout.tileTransition, '0s', 'reduced motion removes tile transitions')
    }

    for (const [button, title] of [
      ['Service catalog', 'Service catalog'],
      ['Booking & scheduling', 'Booking & scheduling'],
      ['Business & invoices', 'Business & invoices'],
      ['Company payment QRs', 'Company payment QRs'],
      ['Home service, delivery & warranty', 'Home service, delivery & warranty'],
      ['Reference data & taxes', 'Reference data & taxes'],
    ]) {
      await page.getByRole('button', { name: new RegExp('^' + button) }).click()
      await expect(page.getByRole('dialog', { name: title })).toBeVisible()
      await page.keyboard.press('Escape')
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'Service catalog' }).click()
    const catalog = page.getByRole('dialog', { name: 'Service catalog' })
    await expect(catalog.locator('.service-catalog-card')).toHaveCount(9)
    const columns = await catalog.locator('.service-catalog-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
    assert.equal(columns, 2)
    await catalog.locator('.service-catalog-toolbar').getByRole('button', { name: 'Add service' }).click()
    const addService = page.getByRole('dialog', { name: 'Add service' })
    await addService.getByLabel('Service name').fill('Bench cleaning')
    await addService.getByLabel('Estimated price (PHP)').fill('250')
    await addService.getByRole('button', { name: 'Add service', exact: true }).click()
    const newCard = catalog.locator('.service-catalog-card').filter({ hasText: 'Bench cleaning' })
    await expect(newCard).toBeVisible()
    await newCard.getByRole('button', { name: 'Edit' }).click()
    const editService = page.getByRole('dialog', { name: 'Edit service' })
    await editService.getByLabel('Service name').fill('Bench cleaning plus')
    await editService.getByRole('button', { name: 'Save service' }).click()
    const editedCard = catalog.locator('.service-catalog-card').filter({ hasText: 'Bench cleaning plus' })
    await expect(editedCard).toBeVisible()
    await editedCard.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog', { name: 'Delete service?' }).getByRole('button', { name: 'Delete service', exact: true }).click()
    await expect(editedCard).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Company payment QRs' }).click()
    const payments = page.getByRole('dialog', { name: 'Company payment QRs' })
    const account = payments.locator('.payment-account-card').first()
    await account.getByRole('checkbox', { name: 'Offer this manual payment option' }).check()
    await account.getByRole('button', { name: /^Save (bank|e-wallet) QR$/ }).click()
    await expect(account.getByRole('alert')).toContainText('Add the provider name')
    const currentType = await account.getByLabel('Type').inputValue()
    await account.getByLabel('Type').selectOption(currentType === 'Bank transfer' ? 'E-wallet' : 'Bank transfer')
    await expect(account.getByRole('alert')).toHaveCount(0)
    await expect(account.getByRole('button', { name: currentType === 'Bank transfer' ? 'Save e-wallet QR' : 'Save bank QR' })).toBeVisible()
    await page.keyboard.press('Escape')

    for (const title of ['Business & invoices', 'Company payment QRs', 'Home service, delivery & warranty', 'Reference data & taxes']) {
      await page.setViewportSize({ width: 320, height: 700 })
      await page.getByRole('button', { name: new RegExp('^' + title) }).click()
      const dialog = page.getByRole('dialog', { name: title })
      const fit = await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, width: element.clientWidth, scrollWidth: element.scrollWidth }
      })
      assert.ok(fit.left >= -1 && fit.right <= 321 && fit.scrollWidth <= fit.width + 1, `${title} overflows at 320px: ${JSON.stringify(fit)}`)
      await page.keyboard.press('Escape')
    }

    await page.goto('http://127.0.0.1:5187/dashboard')
    await page.getByRole('button', { name: 'Profile settings' }).click()
    const profile = page.getByRole('dialog', { name: 'Your profile' })
    await expect(profile.locator('.customer-settings-modal')).toBeVisible()
    await expect(profile).toContainText('ADMIN ACCOUNT')
    await expect(profile.getByRole('textbox', { name: 'Display name' })).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
    await profile.getByRole('button', { name: 'Display & access' }).click()
    await expect(page.getByRole('dialog', { name: 'Display & account access' })).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.getByRole('button', { name: 'Profile & contact' }).click()
    await profile.getByRole('textbox', { name: 'Display name' }).fill('Updated admin name')
    await expect(profile.getByText('You have unsaved changes')).toBeVisible()
    await profile.getByRole('button', { name: 'Close Your profile' }).click()
    await expect(page.getByRole('dialog', { name: 'Discard account changes?' })).toBeVisible()
    await page.getByRole('dialog', { name: 'Discard account changes?' }).getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByRole('dialog', { name: 'Your profile' })).toHaveCount(0)
    await expect(page).toHaveURL(/\/dashboard$/)

    for (const width of [1024, 600, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 680 : 900 })
      await page.getByRole('button', { name: 'Profile settings' }).click()
      const modal = page.getByRole('dialog', { name: 'Your profile' })
      await expect(modal).toBeVisible()
      const fit = await modal.evaluate((dialog) => {
        const rect = dialog.getBoundingClientRect()
        const body = dialog.querySelector('.dialog-body')
        return {
          left: rect.left,
          right: rect.right,
          bodyWidth: body.clientWidth,
          bodyContentWidth: body.scrollWidth,
        }
      })
      assert.ok(fit.left >= -1 && fit.right <= width + 1, `Profile modal overflows at ${width}px`)
      assert.ok(fit.bodyContentWidth <= fit.bodyWidth + 1, `Profile modal body overflows at ${width}px`)
      await page.keyboard.press('Escape')
    }

    await page.setViewportSize({ width: 1024, height: 900 })
    await page.getByRole('button', { name: 'Profile settings' }).click()
    const accountDialog = page.getByRole('dialog', { name: 'Your profile' })
    await accountDialog.getByRole('textbox', { name: 'Display name' }).fill('Workshop admin')
    await accountDialog.getByRole('button', { name: 'Save changes' }).click()
    await page.getByRole('dialog', { name: 'Save account changes?' }).getByRole('button', { name: 'Save changes' }).click()
    await expect(accountDialog.getByText('Your changes are saved.')).toBeVisible()
    await expect(page.locator('.admin-account-link')).toContainText('Workshop admin')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Your profile' })).toHaveCount(0)
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: 'Profile settings' }).click()
    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('dialog', { name: 'Your profile' })).toHaveCount(0)
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server.close()
  }
})
