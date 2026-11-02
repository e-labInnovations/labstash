import { expect, test } from '@playwright/test'

// Needs `npm run seed` data and `npm run dev` (auto-login as the dev user).

test('search finds a part by value and package, and shows where it is', async ({ page }) => {
  await page.goto('/search?q=10k+0603')
  const result = page.getByRole('link', { name: /10K OHM 0603 SMD RESISTOR/ })
  await expect(result).toBeVisible()
  await expect(page.getByRole('link', { name: /^B01-\d+/ }).first()).toBeVisible()

  await result.click()
  await expect(page.getByRole('heading', { name: 'Where it is' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Take' })).toBeEnabled()
})

test('a box shows its compartment grid', async ({ page }) => {
  await page.goto('/l/B03')
  await expect(page.getByRole('heading', { name: 'B03' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^B03-01: 1 kinds of parts/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^B03-24: empty/ })).toBeVisible()
})

test('the inbox lists parts waiting to be put away', async ({ page }) => {
  await page.goto('/inbox')
  await expect(page.getByRole('button', { name: 'Put away' }).first()).toBeVisible()
})

test('the admin panel opens', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('link', { name: /Parts/ }).first()).toBeVisible()
})
