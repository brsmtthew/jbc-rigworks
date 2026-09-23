import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function signInAs(page: Page, role: 'admin' | 'customer') {
  await page.goto('/login')
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear() })
  await page.reload()
  if (role === 'admin') await page.getByRole('button', { name: 'Admin workspace' }).click()
  await page.getByLabel('Email address').fill(`${role}@example.com`)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(role === 'admin' ? /dashboard$/ : /customer$/)
}

test('unauthenticated visitors land on the branded login page', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in to JBC RigWorks' })).toBeVisible()
  await expect(page.getByText('Sample workspace')).toHaveCount(0)
})

test('customer registration opens the customer portal without seeded records', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Full name').fill('Jamie Customer')
  await page.getByLabel('Email address').fill('jamie@example.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/customer$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No appointments yet' })).toBeVisible()
  await expect(page.getByText('sample', { exact: false })).toHaveCount(0)
})

test('customer can request an appointment and see it in their account', async ({ page }) => {
  await signInAs(page, 'customer')
  await page.getByRole('link', { name: 'Services & booking' }).click()
  await page.getByRole('link', { name: 'Book a service', exact: true }).click()
  await page.getByRole('button', { name: 'Start booking' }).click()
  await page.getByLabel('Device or model').fill('Lenovo Legion 5')
  await page.getByLabel('Preferred date').fill('2027-01-15')
  await page.getByLabel('Preferred time').selectOption({ label: '2:00 PM - 4:00 PM' })
  await page.getByLabel('What should we know?').fill('High temperatures during gaming.')
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('heading', { name: 'Your appointment request is in.' })).toBeVisible()
  await page.getByRole('button', { name: 'View my appointments' }).click()
  await expect(page.getByRole('heading', { name: 'My records' })).toBeVisible()
  await expect(page.getByText('Lenovo Legion 5')).toBeVisible()
  await expect(page.getByText('Requested', { exact: true })).toBeVisible()
})

test('customer can submit a custom PC request', async ({ page }) => {
  await signInAs(page, 'customer')
  await page.getByRole('link', { name: 'PC builder', exact: true }).click()
  await page.getByRole('button', { name: 'Select Processor', exact: true }).click()
  await page.getByLabel('Processor from stock').selectOption('__custom')
  await page.getByLabel('Processor model', { exact: true }).fill('My workstation CPU')
  await page.getByLabel('Physical CPU cores').fill('8')
  await page.getByRole('button', { name: 'Use component' }).click()
  await page.getByRole('button', { name: 'Build details', exact: true }).click()
  await page.getByLabel('Build name').fill('Creator build')
  await page.getByLabel('Target budget (PHP)').fill('60000')
  await page.getByRole('dialog').getByRole('button', { name: 'Save build', exact: true }).click()
  await page.getByRole('button', { name: 'Request a quote' }).click()
  await page.getByLabel('Primary use').selectOption('Content creation')
  await page.getByLabel('Build request notes').fill('Quiet workstation for video editing.')
  await page.getByRole('button', { name: 'Request this build', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Build request saved')
  await page.getByRole('link', { name: 'View build requests' }).click()
  await expect(page.getByRole('heading', { name: 'My records' })).toBeVisible()
  await expect(page.getByText('Content creation PC')).toBeVisible()
})

test('admin sees a real empty workspace and customer routes are isolated', async ({ page }) => {
  await signInAs(page, 'admin')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.locator('.metric-grid').getByText('₱0')).toHaveCount(4)
  await expect(page.getByText('No sales for this period.', { exact: false })).toBeVisible()
  await page.goto('/customer')
  await expect(page).toHaveURL(/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Sample workspace')).toHaveCount(0)
})

test('sidebar and topbar remain usable at mobile and desktop widths', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await signInAs(page, 'customer')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && Array.from(document.querySelectorAll('.page-content')).every(element => element.scrollWidth <= element.clientWidth))).toBe(true)
    if (width < 1025) await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('link', { name: 'PC builder', exact: true }).filter({ visible: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && Array.from(document.querySelectorAll('.page-content')).every(element => element.scrollWidth <= element.clientWidth))).toBe(true)
  }
})

test('login, customer booking, and admin overview pass accessibility checks', async ({ page }) => {
  for (const route of ['/login', '/register']) {
    await page.goto(route)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(result.violations.map(item => item.id)).toEqual([])
  }
  await signInAs(page, 'customer')
  await page.goto('/customer/book')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations.map(item => item.id)).toEqual([])
  await page.getByRole('button', { name: 'Account and settings' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await signInAs(page, 'admin')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations.map(item => item.id)).toEqual([])
})
