import { expect, test } from '@playwright/test'

const consentKey = 'create-stack.analytics-consent'

test.describe('analytics consent', () => {
  test('keeps analytics off until the visitor makes a choice', async ({ page }) => {
    await page.goto('/')

    const dialog = page.getByRole('dialog', { name: 'Analytics, on your terms.' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Refuse' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Accept analytics' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open privacy settings' })).not.toBeVisible()

    await dialog.getByRole('button', { name: 'Refuse' }).click()
    await expect(page.getByRole('button', { name: 'Open privacy settings' })).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('v1:rejected')
  })

  test('can accept analytics and change the choice later', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Accept analytics' }).click()
    await expect(page.getByRole('button', { name: 'Open privacy settings' })).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('v1:accepted')

    await page.getByRole('button', { name: 'Open privacy settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Analytics, on your terms.' })).toBeVisible()
    await page.getByRole('button', { name: 'Refuse' }).click()
    expect(await page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('v1:rejected')
  })

  test('links the consent choice to the privacy page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Read the privacy page ↗' }).click()

    await expect(page).toHaveURL(/\/privacy$/)
    await expect(
      page.getByRole('heading', { name: 'Analytics with a clear boundary.' }),
    ).toBeVisible()
    await expect(page.getByText('Analytics is off by default')).toBeVisible()
  })
})
