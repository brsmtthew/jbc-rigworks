import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function openWorkspace(page: Page, role: 'admin' | 'customer' = 'admin') {
  await page.goto('/login')
  await page.evaluate(role => {
    sessionStorage.setItem('jbc-rigworks:session', JSON.stringify({ id: 'test@example.com', name: 'Test user', email: 'test@example.com', role }))
  }, role)
  await page.goto(role === 'admin' ? '/dashboard' : '/customer')
}
async function fill(page: Page, fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value)
}

test('admin records persist, editing updates reports, filters and Excel work', async ({ page }) => {
  await openWorkspace(page)
  await page.goto('/sales')
  await page.getByRole('button', { name: 'Record sale', exact: true }).click()
  await fill(page, { 'Customer name': 'Jamie', 'Service or product': 'PC assembly', 'Sale date': '2026-09-22', 'Total amount (PHP)': '12000', 'Amount received (PHP)': '4000', 'Cost of sale (PHP)': '5000' })
  await page.getByRole('button', { name: 'Save record' }).click()
  await expect(page.getByRole('cell', { name: 'Partial', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('cell', { name: /Jamie/ })).toBeVisible()
  await expect(page.locator('.workspace-clock')).toBeVisible()
  await page.getByRole('button', { name: /^Edit INV-/ }).click()
  await page.getByLabel('Amount received (PHP)').fill('13000')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('alert')).toContainText('cannot exceed')
  await page.getByLabel('Amount received (PHP)').fill('12000')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('cell', { name: 'Paid', exact: true })).toBeVisible()
  await page.getByLabel('Search sales', { exact: true }).fill('missing')
  await expect(page.getByRole('heading', { name: 'No matching records' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel' }).click()
  await page.getByRole('button', { name: 'Download Excel' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('sales.xlsx')
  await page.setViewportSize({ width: 320, height: 740 })
  const row = page.locator('.data-table tbody tr').first()
  await expect(row).toBeVisible()
  expect(await row.evaluate(element => element.getBoundingClientRect().right <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/expenses')
  await page.getByRole('button', { name: 'Record expense' }).click()
  await fill(page, { Description: 'Workshop rent', Category: 'Rent', 'Expense date': '2026-09-22', 'Amount (PHP)': '1500' })
  await page.getByRole('button', { name: 'Save record' }).click()
  await page.goto('/reports?period=2026-09')
  await expect(page.locator('.report-highlight')).toContainText('₱5,500.00')
  await expect(page.locator('.report-total').last()).toContainText('₱0.00')
  await page.getByLabel('Report period').fill('2026-08')
  await expect(page.locator('.report-highlight')).toContainText('₱0.00')
  await page.goto('/dashboard?period=2026-09')
  await expect(page.getByText('View chart values', { exact: true })).toHaveCount(0)
  await page.locator('.revenue-chart g[tabindex]').first().focus()
  await expect(page.locator('.chart-readout')).toContainText('₱12,000.00')
  await expect(page.locator('.metric-card-dark')).toContainText('₱5,500')
})

test('inventory editing refreshes stock watch and duplicate SKUs are rejected', async ({ page }) => {
  await openWorkspace(page)
  await page.goto('/inventory')
  await page.getByRole('button', { name: 'Add item' }).click()
  await fill(page, { 'Item name': 'Thermal paste', SKU: 'TP-01', Category: 'Supplies', 'Stock quantity': '2', 'Minimum stock': '3', 'Unit cost (PHP)': '100', 'Selling price (PHP)': '180' })
  await page.getByRole('button', { name: 'Save record' }).click()
  await page.getByRole('button', { name: 'Add item' }).click()
  await fill(page, { 'Item name': 'Duplicate paste', SKU: 'tp-01', Category: 'Supplies' })
  await page.getByRole('button', { name: 'Save record' }).click()
  await expect(page.getByRole('alert')).toContainText('SKU already exists')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.goto('/dashboard')
  await expect(page.getByText('Low-stock items').locator('..')).toContainText('1')
  await page.goto('/inventory')
  await page.getByRole('button', { name: /^Edit STK-/ }).click()
  await page.getByLabel('Stock quantity').fill('12')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.goto('/dashboard')
  await expect(page.getByText('Low-stock items').locator('..')).toContainText('0')
})

test('jobs can progress from queued to completed', async ({ page }) => {
  await openWorkspace(page)
  await page.goto('/jobs')
  await page.getByRole('button', { name: 'New service job' }).click()
  await fill(page, { 'Customer name': 'Alex', 'Device / model': 'Desktop PC', 'Service requested': 'Cleaning', 'Quoted price (PHP)': '500' })
  await page.getByRole('button', { name: 'Save record' }).click()
  await page.getByRole('button', { name: 'Manage job' }).click()
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('Completed')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.locator('.job-card')).toContainText('Completed')
  await page.reload()
  await expect(page.locator('.job-card')).toContainText('Completed')
  await expect(page.locator('.mini-stats > div').first()).toContainText('0')
})

test('storage failure keeps the admin form and provides a useful error', async ({ page }) => {
  await openWorkspace(page)
  await page.goto('/expenses')
  await page.getByRole('button', { name: 'Record expense' }).click()
  await fill(page, { Description: 'Internet', Category: 'Utilities', 'Amount (PHP)': '1500' })
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') } })
  await page.getByRole('button', { name: 'Save record' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not save')
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Internet')
})

test('navigation is sticky, exact and keyboard accessible with no horizontal page overflow', async ({ page }) => {
  await openWorkspace(page, 'customer')
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 740 })
    for (const route of ['/customer', '/customer/book', '/customer/build', '/customer/pc-building', '/customer/appointments', '/customer/requests']) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && Array.from(document.querySelectorAll('.page-content')).every(element => element.scrollWidth <= element.clientWidth))).toBe(true)
      await page.evaluate(() => document.querySelector('.page-content')!.scrollTo(0, 600))
      await expect.poll(async () => (await page.locator('.topbar').boundingBox())?.y).toBe(0)
      if (width > 1024) {
        await expect(page.locator('.sidebar-nav .is-active')).toHaveCount(1)
        expect(Math.abs((await page.locator('.app-sidebar').boundingBox())?.y ?? 999)).toBeLessThan(1)
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 740 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.drawer-dialog .sidebar-nav .is-active')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Search workspace' })).toHaveCount(0)
  await expect(page.locator('.workspace-clock')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('admin pages fit narrow screens and new surfaces pass accessibility', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openWorkspace(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    for (const route of ['/dashboard', '/jobs', '/sales', '/inventory', '/expenses', '/reports', '/pc-building']) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && Array.from(document.querySelectorAll('.page-content')).every(element => element.scrollWidth <= element.clientWidth))).toBe(true)
    }
  }
  let audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })) ).toEqual([])
  await page.goto('/sales')
  await page.getByRole('button', { name: 'Record sale' }).click()
  audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations.map(item => item.id)).toEqual([])
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})
