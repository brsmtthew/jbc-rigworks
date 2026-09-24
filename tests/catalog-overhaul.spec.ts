import { test, expect, type Page } from '@playwright/test'
import type { ComponentType, InventoryItem } from '../src/types/business'

const components: ComponentType[] = ['Processor', 'Motherboard', 'Memory', 'Graphics', 'Storage', 'Power supply', 'Case', 'Cooling']
const inventory: InventoryItem[] = components.map((component, index) => ({
  id: `part-${index}`, name: `${component} record`, sku: `PART-${index}`, category: component, component,
  kind: 'part', brand: index === 0 ? 'AMD' : 'JBC', model: index === 0 ? 'Ryzen 7 catalog model' : `${component} catalog model`,
  stock: 4, minimum: 1, price: 1000 + index * 100, cost: 500, specs: `${component} manufacturer specifications`,
  tier: 'Low', ...(component === 'Processor' ? { cores: 8 } : {}), ...(component === 'Graphics' ? { vramGb: 12 } : {}), ...(component === 'Memory' ? { memoryGb: 32 } : {}),
}))
inventory.push({ id: 'asset-1', name: 'Precision screwdriver set', sku: 'TOOL-1', category: 'Tools', kind: 'asset', assetTag: 'JBC-TOOL-001', location: 'Assembly bench', stock: 1, minimum: 0, price: 0, cost: 800, specs: 'Workshop equipment' })

async function setup(page: Page) {
  await page.goto('/login')
  await page.evaluate(items => {
    localStorage.clear()
    sessionStorage.setItem('jbc-rigworks:session', JSON.stringify({ id: 'catalog-admin@test.com', email: 'catalog-admin@test.com', name: 'Admin', role: 'admin' }))
    localStorage.setItem('jbc-rigworks:shop-owner:v1', 'catalog-admin@test.com')
    localStorage.setItem('jbc-rigworks:workspace:v1:catalog-admin@test.com', JSON.stringify({ jobs: [], sales: [{ id: 'INV-CHART', customer: 'Chart customer', detail: 'PC part', date: '2026-03-03', total: 2500, paid: 700, cost: 1200, status: 'Partial', paymentHistory: [{ id: 'PAY-1', date: '2026-03-11T04:00:00.000Z', amount: 700, method: 'Cash' }] }], expenses: [], inventory: items, bundles: [] }))
  }, inventory)
  await page.goto('/dashboard')
}

test('daily chart shows every day and dates collections by payment date', async ({ page }) => {
  await setup(page)
  await page.goto('/dashboard?period=2026-03')
  await expect(page.locator('.daily-chart-day')).toHaveCount(31)
  await expect(page.getByRole('region', { name: /Daily sales and collections for March 2026/ })).toBeVisible()
  const saleBar = await page.locator('.daily-chart-day').nth(2).locator('.daily-bar-sales').evaluate(node => getComputedStyle(node).height)
  const collectionBar = await page.locator('.daily-chart-day').nth(10).locator('.daily-bar-received').evaluate(node => getComputedStyle(node).height)
  expect(parseFloat(saleBar)).toBeGreaterThan(0)
  expect(parseFloat(collectionBar)).toBeGreaterThan(0)
  expect(await page.locator('.daily-chart-day').nth(10).getAttribute('aria-label')).toContain('collections')
})

test('parts directory, customer shop, component picker, and asset exclusion share catalog rules', async ({ page }) => {
  await setup(page)
  await page.goto('/pc-directory')
  await expect(page.getByRole('heading', { name: 'PC parts directory' })).toBeVisible()
  await expect(page.getByRole('row', { name: /AMD Ryzen 7 catalog model/ })).toBeVisible()
  await page.getByLabel('Search PC parts').fill('manufacturer specifications')
  await expect(page.locator('.data-table tbody tr')).toHaveCount(8)

  await page.evaluate(() => sessionStorage.setItem('jbc-rigworks:session', JSON.stringify({ id: 'catalog-customer@test.com', email: 'catalog-customer@test.com', name: 'Customer', role: 'customer' })))
  await page.goto('/customer/shop')
  await expect(page.locator('.pos-product')).toHaveCount(8)
  await expect(page.getByText('Workshop service')).toHaveCount(0)
  await expect(page.getByText('Precision screwdriver set')).toHaveCount(0)
  const card = page.locator('.pos-product').first()
  const inspect = card.getByRole('button', { name: /View specs for/ })
  expect((await inspect.boundingBox())?.width).toBeLessThan(60)
  await inspect.click()
  await expect(page.getByRole('dialog').last().getByRole('heading', { name: 'AMD Ryzen 7 catalog model' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/customer/pc-building')
  await page.getByRole('button', { name: 'Rotate PC case view' }).click()
  await expect(page.locator('.pc-model-rotate')).toHaveAttribute('style', /rotateY\(12deg\)/)
  await page.getByRole('button', { name: 'Select Processor', exact: true }).click()
  await page.getByLabel('Processor from stock').selectOption('part-0')
  await page.getByRole('button', { name: 'Use component' }).click()
  await expect(page.locator('.selected-part-name').first()).toContainText('AMD / Ryzen 7 catalog model')
  await expect(page.locator('.part-selection').first()).toContainText('High component rating')
  for (const [component, id] of [['Memory', 'part-2'], ['Graphics', 'part-3']]) {
    await page.getByRole('button', { name: `Select ${component}`, exact: true }).click()
    await page.getByLabel(`${component} from stock`).selectOption(id)
    await page.getByRole('button', { name: 'Use component' }).click()
  }
  await expect(page.locator('.budget-total')).toContainText('High-spec PC set')

  await page.evaluate(() => sessionStorage.setItem('jbc-rigworks:session', JSON.stringify({ id: 'catalog-admin@test.com', email: 'catalog-admin@test.com', name: 'Admin', role: 'admin' })))
  await page.goto('/inventory')
  await page.getByLabel('Filter by inventory role').selectOption('asset')
  await expect(page.locator('.data-table tbody tr')).toContainText('Precision screwdriver set')
  await page.goto('/pos')
  await expect(page.getByText('Precision screwdriver set')).toHaveCount(0)
})

test('PC set summary remains sticky on desktop and chart stays within mobile viewport', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pc-building')
  const summary = page.locator('.build-summary')
  const top = (await summary.boundingBox())!.y
  await page.locator('#main-content').evaluate(element => { element.scrollTop = 550 })
  await expect.poll(async () => (await summary.boundingBox())!.y).toBeLessThanOrEqual(top)
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('/dashboard?period=2026-03')
  await expect(page.locator('.daily-chart-day')).toHaveCount(31)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
