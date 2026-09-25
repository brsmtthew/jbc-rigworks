import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const inventory = ['Processor', 'Motherboard', 'Memory', 'Graphics', 'Storage', 'Power supply', 'Case', 'Cooling'].map((component, index) => ({
  id: `part-${index}`, name: `${component} stock model`, sku: `PC-${index}`, category: component, component,
  stock: 4, minimum: 1, price: 1000 + index * 100, cost: 500, tier: 'Mid',
}))

async function setup(page: Page, customer = false) {
  await page.goto('/login')
  await page.evaluate(({ inventory, customer }) => {
    localStorage.clear()
    sessionStorage.setItem('jbc-rigworks:session', JSON.stringify({ id: customer ? 'customer@test.com' : 'admin@test.com', email: 'test@test.com', name: 'Test', role: customer ? 'customer' : 'admin' }))
    localStorage.setItem('jbc-rigworks:shop-owner:v1', 'admin@test.com')
    localStorage.setItem('jbc-rigworks:workspace:v1:admin@test.com', JSON.stringify({ jobs: [], sales: [], expenses: [], inventory, bundles: [] }))
  }, { inventory, customer })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(customer ? '/customer/pc-building' : '/pc-building')
}

test('3D choices sync with forms, saved builds and checkout without changing stock', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await setup(page)
  await expect(page.locator('.jbc-pc__canvas canvas')).toBeVisible()
  await page.locator('.jbc-pc__card[data-category="cpu"]').click()
  await page.locator('.jbc-pc__product[data-item="part-0"]').click()
  await expect(page.locator('.budget-total')).toContainText('1 of 8')
  await expect(page.locator('.selected-part-name').first()).toContainText('Processor stock model')
  await page.getByRole('button', { name: 'Select Processor', exact: true }).click()
  await expect(page.getByLabel('Processor from stock')).toHaveValue('part-0')
  await page.getByLabel('Processor from stock').selectOption('')
  await page.getByRole('button', { name: 'Use component', exact: true }).click()
  await expect(page.locator('.jbc-pc__product[data-item="part-0"]')).toHaveAttribute('aria-pressed', 'false')
  await page.locator('.jbc-pc__product[data-item="part-0"]').click()
  await page.getByRole('button', { name: 'Save build', exact: true }).click()
  await page.getByLabel('Build name', { exact: true }).fill('My 3D build')
  await page.getByRole('dialog').getByRole('button', { name: 'Save build', exact: true }).click()
  await page.getByRole('dialog', { name: 'Save this build?', exact: true }).getByRole('button', { name: 'Save build', exact: true }).click()
  await expect(page.locator('.pc-build-tools').getByRole('status')).toContainText('Build saved')
  await page.reload()
  await page.getByRole('button', { name: 'Build details', exact: true }).click()
  await page.getByLabel('Saved builds').selectOption({ label: 'My 3D build' })
  await page.keyboard.press('Escape')
  await expect(page.locator('.jbc-pc__card[data-category="cpu"]')).toContainText('Processor stock model')
  await page.getByRole('button', { name: 'Order selected parts', exact: true }).click()
  await expect(page).toHaveURL(/\/pos$/)
  await expect(page.locator('.cart-line')).toContainText('Processor stock model')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('jbc-rigworks:workspace:v1:admin@test.com')!).inventory[0].stock)).toBe(4)
  expect(errors).toEqual([])
})

test('live inventory updates and 3D choices preserve owned and unavailable selections', async ({ page }) => {
  await setup(page, true)
  await expect(page.locator('.jbc-pc__canvas canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Select Memory', exact: true }).click()
  await page.getByLabel('Memory from stock').selectOption('__custom')
  await page.getByLabel('Memory model', { exact: true }).fill('Owned RAM')
  await page.getByRole('button', { name: 'Use component', exact: true }).click()
  await page.locator('.jbc-pc__card[data-category="cpu"]').click()
  await page.locator('.jbc-pc__product[data-item="part-0"]').click()
  await expect(page.locator('.selected-part-name').nth(2)).toContainText('Owned RAM')
  await page.evaluate(() => {
    const key = 'jbc-rigworks:workspace:v1:admin@test.com'
    const data = JSON.parse(localStorage.getItem(key)!)
    data.inventory[0].stock = 0
    data.inventory[1].price = 2500
    localStorage.setItem(key, JSON.stringify(data))
    window.dispatchEvent(new Event('jbc-workspace-change'))
  })
  await expect(page.locator('.jbc-pc__product[data-item="part-0"]')).toBeDisabled()
  await expect(page.locator('.pc-build-feedback')).toContainText('One or more selected parts are unavailable')
  await page.locator('.jbc-pc__card[data-category="motherboard"]').click()
  await page.locator('.jbc-pc__product[data-item="part-1"]').click()
  await expect(page.locator('.budget-total')).toContainText('3,500.00')
  await expect(page.locator('.selected-part-name').first()).toContainText('Processor stock model')
  await expect(page.locator('.selected-part-name').nth(2)).toContainText('Owned RAM')
  await page.getByRole('button', { name: 'Identify my PC', exact: true }).click()
  await expect(page.locator('.jbc-pc__canvas canvas')).toHaveCount(0)
  await page.getByRole('button', { name: 'Build & request', exact: true }).click()
  await expect(page.locator('.jbc-pc__canvas canvas')).toHaveCount(1)
  await expect(page.locator('.jbc-pc__card[data-category="motherboard"]')).toContainText('Motherboard stock model')
})

test('3D controls fit desktop and mobile and remain accessible', async ({ page }, testInfo) => {
  await setup(page)
  await expect(page.locator('.jbc-pc__canvas canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Exploded view', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Exploded view', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Show side panel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Show side panel', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const toolbar = page.locator('.jbc-pc__toolbar')
    await toolbar.scrollIntoViewIfNeeded()
    const bounds = (await toolbar.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width !== 768) await page.screenshot({ path: testInfo.outputPath(`builder-${width}.png`) })
  }
  const audit = await new AxeBuilder({ page }).include('.pc-3d-builder').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([])
})

test('WebGL failure leaves the existing picker and build actions usable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null
      return Reflect.apply(getContext, this, [type, ...args])
    } as typeof getContext
  })
  await setup(page)
  await expect(page.getByText(/3D preview unavailable in this browser/)).toBeVisible()
  await page.getByRole('button', { name: 'Select Processor', exact: true }).click()
  await page.getByLabel('Processor from stock').selectOption('part-0')
  await page.getByRole('button', { name: 'Use component', exact: true }).click()
  await expect(page.locator('.budget-total')).toContainText('1 of 8')
  await expect(page.getByRole('button', { name: 'Order selected parts', exact: true })).toBeEnabled()
})
