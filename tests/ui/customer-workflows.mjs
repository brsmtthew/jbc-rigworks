import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

test('customer booking, records, builder status, and topbar actions', { timeout: 180000 }, async () => {
  const server = await createServer({ configFile: 'tests/ui/vite.config.mjs' })
  await server.listen()
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      window.__printCount = 0
      window.print = () => {
        window.__printCount += 1
      }
    })
    await page.route(/https?:\/\/(?!127\.0\.0\.1:5187)/, (route) => route.abort())
    await page.route(/\.(?:png|jpe?g|webp|gif|avif)(?:\?|$)/i, (route) => route.abort())

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://127.0.0.1:5187/customer/pc-building')
    await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible()
    await expect(page.locator('.pcb-panel')).toHaveCount(0)
    await page.goto('http://127.0.0.1:5187/customer/services')
    await page.evaluate(async () => {
      const { setStoredValue } = await import('/tests/ui/fixtures/preferences.ts')
      const { directoryDefaults } = await import('/src/lib/directories.ts')
      setStoredValue('jbc-rigworks:directories:v1', {
        ...directoryDefaults,
        visibleConditions: [...directoryDefaults.visibleConditions, 'Chipped paint'],
      })
    })
    const desktopTools = await page.locator('.service-catalog-tools').evaluate((tools) => {
      const devices = tools.querySelector('.service-device-filter').getBoundingClientRect()
      const search = tools.querySelector('.service-search').getBoundingClientRect()
      return {
        sameRow: Math.abs(devices.bottom - search.bottom) < 2,
        gap: search.left - devices.right,
        devicesTop: devices.top,
        searchTop: search.top,
        devicesBottom: devices.bottom,
        searchBottom: search.bottom,
      }
    })
    assert.ok(desktopTools.sameRow && desktopTools.gap >= 12, JSON.stringify(desktopTools))

    await page.getByRole('button', { name: 'Choose service' }).first().click()
    const booking = page.getByRole('dialog').first()
    await booking.getByRole('button', { name: /^Workshop/ }).click()
    await booking.getByLabel('Device brand / model').fill('Fixture desktop')
    await booking.getByRole('button', { name: 'Continue' }).click()
    const visitDate = await page.evaluate(() => {
      const day = new Date(Date.now() + 2 * 86400000)
      while (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1)
      return day.toISOString().slice(0, 10)
    })
    await booking.getByLabel('Preferred date').fill(visitDate)
    await booking.locator('.booking-time-option:not([disabled])').first().click()
    await booking.getByRole('button', { name: 'Continue' }).click()
    await booking.getByLabel('Customer name').fill('Jamie Santos')
    await booking.getByLabel('Mobile number').fill('09171234567')
    const conditions = booking.locator('.home-intake-condition-options')
    await expect(conditions.getByRole('checkbox', { name: 'Chipped paint' })).toBeVisible()
    await conditions.getByRole('checkbox', { name: 'Scratches' }).check()
    await conditions.getByRole('checkbox', { name: 'Dents' }).check()
    await expect(conditions.getByRole('checkbox', { name: 'Scratches' })).toBeChecked()
    await expect(conditions.getByRole('checkbox', { name: 'Dents' })).toBeChecked()
    await expect(booking.locator('.home-intake-condition-footer [role="status"]')).toHaveText(
      '2 selected',
    )
    const noDamage = booking.locator('.home-intake-no-damage').getByRole('checkbox')
    await expect(conditions.getByRole('checkbox', { name: 'No visible damage' })).toHaveCount(0)
    await booking.getByLabel('Other visible damage (optional)').fill('Paint chip')
    await noDamage.check()
    await expect(conditions.getByRole('checkbox', { name: 'Scratches' })).not.toBeChecked()
    await expect(conditions.getByRole('checkbox', { name: 'Dents' })).not.toBeChecked()
    await expect(conditions.getByRole('checkbox', { name: 'Scratches' })).toBeDisabled()
    await expect(booking.getByLabel('Other visible damage (optional)')).toBeDisabled()
    await expect(booking.getByLabel('Other visible damage (optional)')).toHaveValue('')
    await expect(booking.locator('.home-intake-condition-footer [role="status"]')).toHaveText(
      'No visible damage selected',
    )
    await noDamage.uncheck()
    await expect(conditions.getByRole('checkbox', { name: 'Cracks' })).toBeEnabled()
    await conditions.getByRole('checkbox', { name: 'Cracks' }).check()
    await expect(noDamage).not.toBeChecked()
    await booking.getByLabel('Describe visible condition or wear').fill('Light scratches')
    await booking.getByLabel('Existing hardware or performance issues').fill('Fan noise')
    await booking.getByLabel('Condition and issue history').fill('Started last week')
    await booking.locator('.home-intake-acknowledgement input').check()
    await booking.getByRole('button', { name: 'Continue' }).click()
    await booking.getByRole('button', { name: 'Submit request' }).click()
    await expect(page.getByRole('dialog', { name: 'Send booking request?' })).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Send booking request?' })
      .getByRole('button', { name: 'Cancel' })
      .click()
    await expect(booking).toBeVisible()
    await page.keyboard.press('Escape')

    await page.goto('http://127.0.0.1:5187/customer/records')
    await expect(page.getByRole('button', { name: 'Edit order INV-fixture' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Cancel order INV-fixture' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Edit order INV-pending' })).toBeEnabled()
    await page.getByRole('button', { name: 'Edit order INV-pending' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Edit order details' }).getByLabel('Receipt email'),
    ).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Edit order details' })
      .getByLabel('Receipt email')
      .fill('jamie@example.test')
    await page
      .getByRole('dialog', { name: 'Edit order details' })
      .getByRole('button', { name: 'Save changes' })
      .click()
    await expect(page.getByRole('dialog', { name: 'Save order changes?' })).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Save order changes?' })
      .getByRole('button', { name: 'Cancel' })
      .click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Cancel order INV-pending' }).click()
    await expect(page.getByRole('dialog', { name: 'Cancel order?' })).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Cancel order?' })
      .getByRole('button', { name: 'Cancel', exact: true })
      .click()
    for (const [tab, selector] of [
      [null, '.customer-order-card'],
      [/^Appointments/, '.request-records > article'],
    ]) {
      if (tab) await page.getByRole('button', { name: tab }).click()
      const actionColumn = await page
        .locator(selector)
        .first()
        .evaluate((card) => {
          const values = card.querySelector('.customer-record-values').getBoundingClientRect()
          const actions = card.querySelector('.customer-record-actions').getBoundingClientRect()
          return {
            besideValues: actions.left >= values.right && actions.top < values.bottom,
            labeled: card.querySelector('.customer-record-actions-label').textContent === 'Actions',
            buttonsFit: [...card.querySelectorAll('.customer-record-action')].every((button) => {
              const rect = button.getBoundingClientRect()
              return rect.left >= actions.left && rect.right <= actions.right
            }),
          }
        })
      assert.ok(
        actionColumn.besideValues && actionColumn.labeled && actionColumn.buttonsFit,
        `${selector}: ${JSON.stringify(actionColumn)}`,
      )
    }
    for (const action of ['View', 'Edit']) {
      await page.getByRole('button', { name: `${action} APT-fixture` }).click()
      const appointmentDialog = page.getByRole('dialog', { name: `${action} appointment` })
      const layout = await appointmentDialog.evaluate((dialog) => {
        const overview = dialog
          .querySelector('.customer-appointment-overview')
          .getBoundingClientRect()
        const details = dialog
          .querySelector('.customer-appointment-details')
          .getBoundingClientRect()
        return {
          wide: dialog.getBoundingClientRect().width >= 900,
          columns: details.left >= overview.right,
          fits: dialog.scrollWidth <= dialog.clientWidth + 1,
        }
      })
      assert.ok(
        layout.wide && layout.columns && layout.fits,
        `${action} appointment: ${JSON.stringify(layout)}`,
      )
      await page.keyboard.press('Escape')
    }
    await page.getByRole('button', { name: /^PC requests/ }).click()
    await expect(page.getByRole('button', { name: 'Edit PC-fixture' })).toHaveCount(0)
    await page.goto('http://127.0.0.1:5187/customer/records')
    await page.getByRole('button', { name: /^Purchases/ }).click()
    await page
      .getByRole('button', { name: /View order/ })
      .first()
      .click()
    const desktopInvoice = await page.getByRole('dialog').evaluate((dialog) => {
      const side = dialog.querySelector('.invoice-view-side').getBoundingClientRect()
      const paper = dialog.querySelector('.invoice-document').getBoundingClientRect()
      return {
        wide: dialog.getBoundingClientRect().width > 900,
        sideBySide: paper.left >= side.right,
        fits: dialog.scrollWidth <= dialog.clientWidth + 1,
      }
    })
    assert.ok(
      desktopInvoice.wide && desktopInvoice.sideBySide && desktopInvoice.fits,
      JSON.stringify(desktopInvoice),
    )
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'View order INV-pending' }).click()
    await expect(page.getByRole('dialog', { name: 'Order slip' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'ORDER SLIP', exact: true })).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    assert.equal(
      await page.locator('.invoice-print-root').evaluate((root) => getComputedStyle(root).display),
      'block',
    )
    await page.emulateMedia({ media: 'screen' })
    await page.keyboard.press('Escape')

    await page.setViewportSize({ width: 768, height: 900 })
    await page.getByRole('button', { name: 'View order INV-pending' }).click()
    const tabletInvoice = await page
      .getByRole('dialog', { name: 'Order slip' })
      .evaluate((dialog) => {
        const side = dialog.querySelector('.invoice-view-side').getBoundingClientRect()
        const paper = dialog.querySelector('.invoice-document').getBoundingClientRect()
        return {
          stacked: paper.top >= side.bottom,
          fits: dialog.scrollWidth <= dialog.clientWidth + 1,
        }
      })
    assert.ok(tabletInvoice.stacked && tabletInvoice.fits, JSON.stringify(tabletInvoice))
    await page.keyboard.press('Escape')

    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto('http://127.0.0.1:5187/customer/services')
    const mobileTools = await page.locator('.service-catalog-tools').evaluate((tools) => {
      const devices = tools.querySelector('.service-device-filter').getBoundingClientRect()
      const search = tools.querySelector('.service-search').getBoundingClientRect()
      const bounds = tools.getBoundingClientRect()
      return {
        stacked: search.top >= devices.bottom,
        fits: devices.right <= bounds.right + 1 && search.right <= bounds.right + 1,
      }
    })
    assert.ok(mobileTools.stacked && mobileTools.fits, JSON.stringify(mobileTools))
    await page.goto('http://127.0.0.1:5187/customer/records')
    await expect(page.getByRole('link', { name: 'Profile and settings' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(page.locator('.customer-clock')).toBeVisible()
    await expect(page.locator('.customer-clock em')).toBeVisible()
    await expect(page.locator('.customer-account-menu')).toHaveCount(0)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('dialog', { name: 'Sign out?' })).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Sign out?' })
      .getByRole('button', { name: 'Cancel' })
      .click()
    await page.getByRole('link', { name: 'Profile and settings' }).click()
    await expect(page).toHaveURL(/\/customer\/settings$/)
    await expect(page.getByRole('dialog', { name: 'Your profile' })).toBeVisible()
    await page.getByRole('button', { name: 'Display & access' }).click()
    await expect(page).toHaveURL(/\/customer\/settings\?section=display$/)
    await expect(page.getByRole('dialog', { name: 'Display & account access' })).toBeVisible()
    await page.getByRole('button', { name: 'Profile & contact' }).click()
    await expect(page).toHaveURL(/\/customer\/settings$/)
    await expect(page.getByRole('dialog', { name: 'Your profile' })).toBeVisible()
    const settingsFit = await page
      .getByRole('dialog', { name: 'Your profile' })
      .evaluate((dialog) => ({
        horizontal: dialog.scrollWidth <= dialog.clientWidth + 1,
        withinViewport: dialog.getBoundingClientRect().width <= innerWidth,
      }))
    assert.ok(settingsFit.horizontal && settingsFit.withinViewport, JSON.stringify(settingsFit))
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const scrollLayout = await page
        .getByRole('dialog', { name: 'Your profile' })
        .evaluate((dialog) => {
          const side = dialog.querySelector('.customer-settings-side')
          const main = dialog.querySelector('.customer-settings-main')
          const body = dialog.querySelector('.dialog-body')
          main.scrollTop = 0
          const sideTop = side.getBoundingClientRect().top
          main.scrollTop = main.scrollHeight
          return {
            mainScrollable: main.scrollHeight > main.clientHeight,
            scrolled: main.scrollTop > 0,
            sideSteady: Math.abs(side.getBoundingClientRect().top - sideTop) < 1,
            bodySteady: body.scrollTop === 0,
            sideFits:
              side.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 1,
          }
        })
      assert.ok(
        Object.values(scrollLayout).every(Boolean),
        `${width}: ${JSON.stringify(scrollLayout)}`,
      )
    }
    await page.setViewportSize({ width: 390, height: 900 })
    await page.getByLabel('Display name').fill('Jamie Updated')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('dialog', { name: 'Save account changes?' })).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Save account changes?' })
      .getByRole('button', { name: 'Cancel' })
      .click()
    await page
      .getByRole('dialog', { name: 'Your profile' })
      .getByRole('button', { name: /Close Your profile/ })
      .click()
    await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Leave without saving?' })
      .getByRole('button', { name: 'Stay here' })
      .click()
    await page
      .getByRole('dialog', { name: 'Your profile' })
      .getByRole('button', { name: 'Discard' })
      .click()
    await expect(page.getByRole('dialog', { name: 'Discard account changes?' })).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Discard account changes?' })
      .getByRole('button', { name: 'Discard changes' })
      .click()
    await page
      .getByRole('dialog', { name: 'Your profile' })
      .getByRole('button', { name: /Close Your profile/ })
      .click()
    await expect(page).toHaveURL(/\/customer$/)
    await page.goto('http://127.0.0.1:5187/customer/records')
    await expect(page.locator('.customer-order-list')).toBeVisible()
    assert.equal(
      await page
        .locator('.customer-order-list')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
      1,
    )

    const orderId = await page
      .locator('.customer-order-card')
      .first()
      .locator('.record-reference')
      .textContent()
    const orderLayout = await page
      .locator('.customer-order-card')
      .first()
      .evaluate((card) => {
        const bounds = card.getBoundingClientRect()
        const values = card.querySelector('.customer-record-values').getBoundingClientRect()
        const actions = card.querySelector('.customer-record-actions').getBoundingClientRect()
        return {
          valuesBeforeActions: values.bottom <= actions.top,
          fits: [values, actions].every(
            (rect) => rect.left >= bounds.left && rect.right <= bounds.right,
          ),
        }
      })
    assert.ok(orderLayout.valuesBeforeActions && orderLayout.fits, JSON.stringify(orderLayout))
    await page.getByRole('button', { name: `View order ${orderId}` }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const invoiceFit = await page.getByRole('dialog').evaluate((dialog) => {
      const side = dialog.querySelector('.invoice-view-side').getBoundingClientRect()
      const paper = dialog.querySelector('.invoice-document').getBoundingClientRect()
      return {
        fits: dialog.scrollWidth <= dialog.clientWidth + 1,
        stacked: paper.top >= side.bottom,
      }
    })
    assert.ok(invoiceFit.fits && invoiceFit.stacked, JSON.stringify(invoiceFit))
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: `Print order ${orderId}` }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__printCount)).toBeGreaterThan(0)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /^Appointments/ }).click()
    await expect(page.locator('.request-records > article')).toHaveCount(1)
    await page.getByRole('button', { name: 'View intake form APT-fixture' }).click()
    await expect(page.getByRole('dialog', { name: 'Intake & service authorization' })).toBeVisible()
    await expect(
      page.getByRole('article', { name: 'Customer intake and service authorization form' }),
    ).toBeVisible()
    assert.ok(
      await page
        .getByRole('dialog', { name: 'Intake & service authorization' })
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
      'Intake preview overflows at 390px',
    )
    await page
      .getByRole('dialog', { name: 'Intake & service authorization' })
      .getByRole('button', { name: 'Print form' })
      .click()
    await expect.poll(() => page.evaluate(() => window.__printCount)).toBeGreaterThan(1)
    await page.emulateMedia({ media: 'print' })
    assert.equal(
      await page
        .locator('.home-intake-print-root')
        .evaluate((root) => getComputedStyle(root).display),
      'block',
    )
    await page.emulateMedia({ media: 'screen' })
    await page.keyboard.press('Escape')
    const appointmentLayout = await page
      .locator('.request-records > article')
      .first()
      .evaluate((card) => {
        const bounds = card.getBoundingClientRect()
        const values = card.querySelector('.customer-record-values').getBoundingClientRect()
        const actions = card.querySelector('.customer-record-actions').getBoundingClientRect()
        return {
          valuesBeforeActions: values.bottom <= actions.top,
          fits: [values, actions].every(
            (rect) => rect.left >= bounds.left && rect.right <= bounds.right,
          ),
        }
      })
    assert.ok(
      appointmentLayout.valuesBeforeActions && appointmentLayout.fits,
      JSON.stringify(appointmentLayout),
    )
    await page.getByRole('button', { name: 'View APT-fixture' }).click()
    await expect(page.getByRole('dialog', { name: 'View appointment' })).toBeVisible()
    await expect(page.getByRole('dialog').locator('textarea')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Edit APT-fixture' }).click()
    await expect(
      page
        .getByRole('dialog', { name: 'Edit appointment' })
        .getByRole('textbox', { name: 'Describe visible condition or wear' }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('dialog', { name: 'Edit appointment' })
        .getByRole('textbox', { name: 'Device brand / model' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Save request changes' }).click()
    await expect(page.getByRole('dialog', { name: 'Save request changes?' })).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Save request changes?' })
      .getByRole('button', { name: 'Cancel' })
      .click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Cancel APT-fixture' }).click()
    await expect(page.getByRole('dialog', { name: 'Cancel request?' })).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Cancel request?' })
      .getByRole('button', { name: 'Cancel', exact: true })
      .click()
    await expect(page.locator('.request-records > article')).toHaveCount(1)
    await page.getByRole('button', { name: 'Print APT-fixture' }).click()
    await expect.poll(() => page.evaluate(() => window.__printCount)).toBeGreaterThan(2)

    await page.setViewportSize({ width: 320, height: 900 })
    const narrowRecord = await page
      .locator('.request-records > article')
      .first()
      .evaluate((card) => {
        const bounds = card.getBoundingClientRect()
        return [
          ...card.querySelectorAll(
            '.request-record-heading, .customer-record-values, .customer-record-actions',
          ),
        ].every((element) => {
          const rect = element.getBoundingClientRect()
          return rect.left >= bounds.left && rect.right <= bounds.right
        })
      })
    assert.ok(narrowRecord, 'Appointment content exceeds its row at 320px')
    await page.getByRole('button', { name: 'View intake form APT-fixture' }).click()
    assert.ok(
      await page
        .getByRole('dialog', { name: 'Intake & service authorization' })
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
      'Intake preview overflows at 320px',
    )
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Edit APT-fixture' }).click()
    assert.ok(
      await page
        .getByRole('dialog', { name: 'Edit appointment' })
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
      'Appointment editor overflows at 320px',
    )
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^Purchases/ }).click()
    await page.getByRole('button', { name: 'View order INV-pending' }).click()
    assert.ok(
      await page
        .getByRole('dialog', { name: 'Order slip' })
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
      'Order slip overflows at 320px',
    )
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Edit order INV-pending' }).click()
    assert.ok(
      await page
        .getByRole('dialog', { name: 'Edit order details' })
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
      'Order editor overflows at 320px',
    )
    await page.keyboard.press('Escape')
    await page.goto('http://127.0.0.1:5187/customer/settings')
    const narrowSettings = await page
      .getByRole('dialog', { name: 'Your profile' })
      .evaluate((dialog) => ({
        width: dialog.getBoundingClientRect().width,
        clientWidth: dialog.clientWidth,
        scrollWidth: dialog.scrollWidth,
      }))
    assert.ok(
      narrowSettings.width <= 320 && narrowSettings.scrollWidth <= narrowSettings.clientWidth + 1,
      JSON.stringify(narrowSettings),
    )
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server.close()
  }
})
